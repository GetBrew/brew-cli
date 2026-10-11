import { BrewApiError } from '@brew.new/sdk'
import { Command, CommanderError } from 'commander'
import { INPUT_KEYS } from './generated/input-keys'
import {
  buildRetryCommand,
  buildUploadRetryCommand,
  enforceConfirmation,
} from './lib/confirm'
import { makeContext, makeFallbackContext } from './lib/context'
import type { CommandMetadata, CommandSpec } from './lib/define-command'
import { commandMetadata, GLOBAL_FLAGS } from './lib/define-command'
import {
  CliApiError,
  CliUsageError,
  type ErrorContext,
  EXIT_OK,
  EXIT_USAGE,
  printError,
  toExitCode,
} from './lib/errors'
import { IDEMPOTENCY_FLAG, INPUT_FLAG } from './lib/input'
import { assertKnownInputKeys } from './lib/input-keys'
import { getInvocationPrefix } from './lib/invocation'
import { matchesTemplate } from './lib/long-running'
import { printData } from './lib/output'
import { type RerunInvocation, readsStdin } from './lib/rerun'
import type { CliContext, CliIo, CommandTraits } from './lib/types'
import { ALL_COMMANDS } from './registry'
import { CLI_NAME, CLI_VERSION } from './version'

const GROUP_SUMMARIES: Readonly<Record<string, string>> = {
  analytics: 'Reports: overview, events, and automation analytics',
  'audience-runs': 'Manual-audience launches: read, pause, resume, cancel',
  'api-keys': 'Manage organization API keys',
  audiences: 'Manage audience segments',
  automations: 'Manage automation graphs, triggers, and runs',
  brand: "Read and update the active brand's design context",
  brands: 'Organization-level brand lifecycle',
  chats: 'List Brew chats, and read one for a hand-off',
  comments: "Read a design's comment threads",
  config: 'Read and write stored CLI configuration',
  contacts: 'Manage contacts',
  content:
    'Content generation (images, GIFs, renders; credit-metered) and the brand image library (add, upload; free)',
  docs: 'Reference material for humans and agents',
  domains: 'Manage sending domains',
  emails: 'Manage email designs and send campaigns',
  fields: 'Manage custom contact fields',
  flows: 'Browse public email flows (real multi-step sequences by brand)',
  groups: 'Manage email folders (groups)',
  insights:
    "Brew Insights: findings about the brand's email, plus its pulse, report, suggestions and memo",
  integrations: 'Read the connected-integration catalog',
  'inbox-placement-tests': 'Inbox placement (seed) test results',
  notifications:
    'What finished or failed: generations, sends, imports, domain checks',
  sends: 'Read sends, and control one in flight or scheduled',
  templates: 'Browse the template gallery',
  contract: 'Stored payload contracts (get, put, validate)',
  contracts: 'Payload-contract helpers',
  triggers: 'Manage trigger events',
  runs: 'Automation run history, and cancel one in-flight run',
  'trigger-instances': 'Fired trigger instances (the inbound-fire audit log)',
}

const AGENT_HELP_FOOTER = `
Environment:
  BREW_API_KEY         API key (overrides stored login; flags override both)
  BREW_BRAND_ID        Brand id for organization-scoped keys
  BREW_API_URL         API base URL (default https://brew.new/api)
  BREW_CLI_CONFIG_DIR  Config directory (default ~/.config/brew-cli)

Exit codes:
  0 success · 1 API/runtime error · 2 usage error · 3 auth error
  4 confirmation required (re-run with --yes)
  130 interrupted (SIGINT) · 143 terminated (SIGTERM)

Agents: run \`${CLI_NAME} docs --agent\` for the machine-readable manifest.
`

export async function run(
  argv: readonly string[],
  io: CliIo,
  commands: readonly CommandSpec[] = ALL_COMMANDS
): Promise<number> {
  let activeContext: CliContext | undefined
  let activeSpec: CommandSpec | undefined
  let activeInvocation: RerunInvocation | undefined
  let commandExitCode: number | undefined
  // Commander's own stderr (usage errors, error-mode help) is buffered so
  // JSON mode can replace it with a structured envelope instead of mixing
  // free text and JSON on the same stream.
  const commanderStderr: string[] = []
  const program = buildProgram(
    io,
    argv,
    (ctx, spec, invocation) => {
      activeContext = ctx
      activeSpec = spec
      activeInvocation = invocation
    },
    commands,
    (text) => {
      commanderStderr.push(text)
    },
    (code) => {
      commandExitCode = code
    }
  )
  const flushCommanderStderr = (): void => {
    for (const text of commanderStderr) {
      io.stderr.write(text)
    }
    commanderStderr.length = 0
  }
  try {
    await program.parseAsync([...argv], { from: 'user' })
    flushCommanderStderr()
    return commandExitCode ?? EXIT_OK
  } catch (error) {
    if (error instanceof CommanderError) {
      const ctx = activeContext ?? makeFallbackContext(io, argv)
      return handleCommanderError(error, ctx, flushCommanderStderr)
    }
    flushCommanderStderr()
    const ctx = activeContext ?? makeFallbackContext(io, argv)
    const reported = reportedError(ctx, error)
    printError(
      ctx,
      reported,
      errorContextFor(ctx, commands, activeSpec, activeInvocation)
    )
    return toExitCode(reported)
  }
}

/**
 * Once the command's signal has aborted — an interrupt or the deadline —
 * its reason is what happened, whatever surfaced first: a prompt that threw
 * its own AbortError, a stream that closed. Only a real HTTP answer that
 * arrived before the abort keeps its own error.
 */
function reportedError(ctx: CliContext, error: unknown): unknown {
  if (!ctx.signal.aborted) {
    return error
  }
  if (error instanceof BrewApiError || error instanceof CliApiError) {
    return error
  }
  return ctx.signal.reason
}

/** What the error envelope needs to know about the command that failed. */
function errorContextFor(
  ctx: CliContext,
  commands: readonly CommandSpec[],
  activeSpec: CommandSpec | undefined,
  invocation: RerunInvocation | undefined
): ErrorContext {
  const request = ctx.transport.lastRequest()
  const drain = ctx.transport.drain()
  // The command bound to the route the failed request actually hit — the
  // `api` escape hatch borrows its class and replay policy from it. A
  // command with an operation of its own answers for itself: a multi-step
  // file upload cannot rerun its original argv under its last request's key.
  // Explicit upload recovery instead builds a finalization-only add-image
  // command from the recorded identity and key in the shared error renderer.
  const bound =
    request === undefined || ctx.traits?.declaresOperation === true
      ? undefined
      : commandFor(request, commands)
  const isRead =
    bound === undefined ? ctx.traits?.isRead : bound.commandClass === 'read'
  const finalizeUpload = commandFor(
    { method: 'POST', path: '/v1/content/add-image' },
    commands
  )
  return {
    ...(request === undefined ? {} : { request }),
    ...(drain === undefined ? {} : { drain }),
    ...(isRead === undefined ? {} : { isRead }),
    replays:
      bound === undefined
        ? ctx.traits?.replays === true
        : (bound.flags ?? []).includes(IDEMPOTENCY_FLAG),
    readsStdin: invocation !== undefined && readsStdin(invocation),
    ...(activeSpec === undefined || invocation === undefined
      ? {}
      : {
          retryCommand: (key: string) =>
            buildRetryCommand(
              invocation,
              key,
              activeSpec,
              getInvocationPrefix(ctx.io.env)
            ),
        }),
    ...(finalizeUpload === undefined
      ? {}
      : {
          retryUploadCommand: (uploadId: string, idempotencyKey: string) =>
            buildUploadRetryCommand(
              {
                uploadId,
                idempotencyKey,
                brand: request?.brandId ?? ctx.globals.brand,
                apiUrl: ctx.globals.apiUrl,
              },
              finalizeUpload,
              getInvocationPrefix(ctx.io.env)
            ),
        }),
  }
}

function commandFor(
  request: { readonly method: string; readonly path: string },
  commands: readonly CommandSpec[]
): CommandSpec | undefined {
  const apiPath = request.path.split('?')[0] ?? ''
  return commands.find(
    (spec) =>
      spec.route !== undefined &&
      spec.route.method === request.method &&
      matchesTemplate(spec.route.path, apiPath)
  )
}

function traitsOf(spec: CommandSpec): CommandTraits {
  return {
    isRead: spec.commandClass === 'read',
    replays: (spec.flags ?? []).includes(IDEMPOTENCY_FLAG),
    declaresOperation:
      spec.route !== undefined ||
      spec.sdkMethod !== null ||
      spec.derivedFrom !== undefined,
    defaultTimeoutMs: spec.defaultTimeoutMs,
    inputKeys: inputKeysOf(spec),
  }
}

/**
 * The top-level keys a command's `--input` object may carry: the path and
 * query parameters and JSON body properties of its route, plus the keys it
 * reads itself. Undefined (nothing checked) when the command takes no
 * `--input`, declares no route, opts out, or its route's body is open.
 */
function inputKeysOf(spec: CommandSpec): ReadonlySet<string> | undefined {
  if (
    spec.inputKeys === 'unchecked' ||
    spec.route === undefined ||
    !(spec.flags ?? []).includes(INPUT_FLAG)
  ) {
    return
  }
  const routeKeys = INPUT_KEYS[`${spec.route.method} ${spec.route.path}`]
  if (routeKeys === undefined) {
    return
  }
  return new Set([...routeKeys, ...(spec.inputKeys?.extra ?? [])])
}

/**
 * Inline `--input` is checked before any confirmation prompt, so a typo is
 * not confirmed first and refused after. Stdin and malformed JSON are left
 * to `readJsonFlag` in the command, which reads them once.
 */
function checkInlineInput(ctx: CliContext, value: unknown): void {
  if (typeof value !== 'string' || value === '-') {
    return
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return
  }
  assertKnownInputKeys(ctx.traits, parsed)
}

function handleCommanderError(
  error: CommanderError,
  ctx: CliContext,
  flush: () => void
): number {
  const isHelpCode =
    error.code === 'commander.helpDisplayed' || error.code === 'commander.help'
  if (
    error.code === 'commander.version' ||
    (isHelpCode && error.exitCode === 0)
  ) {
    flush()
    return EXIT_OK
  }
  if (isHelpCode) {
    // Error-mode help: a group or bare invocation with no subcommand.
    if (ctx.mode === 'json') {
      printError(
        ctx,
        new CliUsageError('Incomplete command: a subcommand is required.')
      )
    } else {
      flush()
    }
    return EXIT_USAGE
  }
  if (ctx.mode === 'json') {
    printError(ctx, new CliUsageError(error.message.replace(/^error: /, '')))
  } else {
    flush()
  }
  return EXIT_USAGE
}

export function buildProgram(
  io: CliIo,
  rawArgv: readonly string[],
  onContext?: (
    ctx: CliContext,
    spec: CommandSpec,
    invocation: RerunInvocation
  ) => void,
  commands: readonly CommandSpec[] = ALL_COMMANDS,
  errSink?: (text: string) => void,
  onExitCode?: (code: number) => void
): Command {
  const writeErr = errSink ?? ((text: string) => io.stderr.write(text))
  const program = new Command(CLI_NAME)
    .description('Agent-first CLI for the Brew public API (brew.new)')
    .version(CLI_VERSION, '--version', 'Print the CLI version')
    .exitOverride()
    .showSuggestionAfterError(false)
    .configureOutput({
      writeOut: (str) => {
        io.stdout.write(str)
      },
      writeErr: (str) => {
        writeErr(str)
      },
    })
  program.addHelpText('after', AGENT_HELP_FOOTER)
  // Global flags register on the root as well as every leaf so agents can
  // place them on either side of the subcommand (`brew-cli --json usage`
  // and `brew-cli usage --json` both work); optsWithGlobals merges them.
  for (const flag of GLOBAL_FLAGS) {
    program.option(flag.flag, flag.summary)
  }
  const metadata = commands.map(commandMetadata)
  for (const spec of commands) {
    registerCommand(program, spec, io, rawArgv, onContext, onExitCode, metadata)
  }
  return program
}

function registerCommand(
  program: Command,
  spec: CommandSpec,
  io: CliIo,
  rawArgv: readonly string[],
  onContext?: (
    ctx: CliContext,
    spec: CommandSpec,
    invocation: RerunInvocation
  ) => void,
  onExitCode?: (code: number) => void,
  metadata: readonly CommandMetadata[] = []
): void {
  const parent = resolveGroup(program, spec.path.slice(0, -1))
  const leafName = spec.path.at(-1)
  if (leafName === undefined) {
    throw new Error('command spec has an empty path')
  }
  const leaf = parent.command(leafName).description(spec.summary)
  for (const arg of spec.args ?? []) {
    const wrapped = arg.isRequired ? `<${arg.name}>` : `[${arg.name}]`
    leaf.argument(wrapped, arg.summary)
  }
  for (const flag of [...(spec.flags ?? []), ...GLOBAL_FLAGS]) {
    if (flag.defaultValue === undefined) {
      leaf.option(flag.flag, flag.summary)
    } else {
      leaf.option(flag.flag, flag.summary, flag.defaultValue)
    }
  }
  leaf.addHelpText('after', buildCommandHelpFooter(spec))
  leaf.action(async (...actionArgs: unknown[]) => {
    const command = actionArgs.at(-1) as Command
    // optsWithGlobals lets ancestors overwrite the leaf; re-apply the
    // leaf's own parsed values so the flag nearest the subcommand wins.
    const flags: Record<string, unknown> = {
      ...command.optsWithGlobals<Record<string, unknown>>(),
    }
    for (const [key, value] of Object.entries(
      command.opts<Record<string, unknown>>()
    )) {
      if (value !== undefined) {
        flags[key] = value
      }
    }
    const positional = (spec.args ?? []).reduce<Record<string, string>>(
      (acc, arg, index) => {
        const value = actionArgs[index]
        if (typeof value === 'string') {
          // An empty required id would otherwise build a malformed API path
          // (`/v1/x//action`) and surface as a confusing server-side 405.
          if (arg.isRequired && value.trim() === '') {
            throw new CliUsageError(`<${arg.name}> must not be empty.`)
          }
          acc[arg.name] = value
        }
        return acc
      },
      {}
    )
    const ctx = makeContext({
      io,
      flags,
      rawArgv,
      traits: traitsOf(spec),
      commands: metadata,
    })
    onContext?.(ctx, spec, { args: positional, flags })
    ctx.startDeadline()
    try {
      checkInlineInput(ctx, flags.input)
      const baseInvocation = { ctx, args: positional, flags }
      const input = await spec.prepareInput?.(baseInvocation)
      ctx.signal.throwIfAborted()
      const invocation = {
        ...baseInvocation,
        ...(input === undefined ? {} : { input }),
      }
      await enforceConfirmation(spec, invocation)
      ctx.signal.throwIfAborted()
      const outcome = await spec.run(invocation)
      if (outcome !== undefined) {
        printData(ctx, outcome.data, outcome.human)
        if (outcome.exitCode !== undefined && outcome.exitCode !== 0) {
          onExitCode?.(outcome.exitCode)
        }
      }
    } finally {
      ctx.stopDeadline()
    }
  })
}

function resolveGroup(program: Command, path: readonly string[]): Command {
  let current = program
  for (const segment of path) {
    const existing = current.commands.find((cmd) => cmd.name() === segment)
    if (existing) {
      current = existing
      continue
    }
    const summary = GROUP_SUMMARIES[segment] ?? ''
    current = current.command(segment).description(summary)
    // Groups accept the global flags too, so `brew-cli contacts --json list`
    // parses instead of failing with a misleading unknown-command error.
    for (const flag of GLOBAL_FLAGS) {
      current.option(flag.flag, flag.summary)
    }
  }
  return current
}

function buildCommandHelpFooter(spec: CommandSpec): string {
  const lines: string[] = ['']
  if (spec.route) {
    lines.push(`API route: ${spec.route.method} ${spec.route.path}`)
  }
  if (spec.commandClass === 'destructive') {
    lines.push('Destructive: requires --yes in non-interactive sessions.')
  }
  if (spec.isCredited === true) {
    lines.push('Credits: this operation can consume Brew credits.')
  }
  lines.push('', 'Examples:')
  for (const example of spec.examples) {
    lines.push(`  ${example}`)
  }
  lines.push('')
  return lines.join('\n')
}
