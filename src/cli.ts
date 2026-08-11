import { Command, CommanderError } from 'commander'
import { enforceConfirmation } from './lib/confirm'
import { makeContext, makeFallbackContext } from './lib/context'
import type { CommandSpec } from './lib/define-command'
import { GLOBAL_FLAGS } from './lib/define-command'
import {
  CliUsageError,
  EXIT_OK,
  EXIT_USAGE,
  printError,
  toExitCode,
} from './lib/errors'
import { printData } from './lib/output'
import type { CliContext, CliIo } from './lib/types'
import { ALL_COMMANDS } from './registry'
import { CLI_NAME, CLI_VERSION } from './version'

const GROUP_SUMMARIES: Readonly<Record<string, string>> = {
  analytics: 'Read campaign, automation, send, and event analytics',
  audiences: 'Manage audience segments',
  automations: 'Manage automation graphs, triggers, and runs',
  brand: "Read and update the active brand's design context",
  brands: 'Organization-level brand lifecycle',
  chats: 'Read Brew chat context for hand-offs',
  config: 'Read and write stored CLI configuration',
  contacts: 'Manage contacts',
  content: 'Credit-metered content generation (images, GIFs, renders)',
  docs: 'Reference material for humans and agents',
  domains: 'Manage sending domains',
  emails: 'Manage email designs and send campaigns',
  fields: 'Manage custom contact fields',
  sends: 'Control in-flight or scheduled sends',
  templates: 'Browse the template gallery',
  triggers: 'Manage trigger events',
  runs: 'Automation run history',
  'trigger-instances': 'Fired trigger instances',
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

Agents: run \`${CLI_NAME} docs --agent\` for the machine-readable manifest.
`

export async function run(
  argv: readonly string[],
  io: CliIo,
  commands: readonly CommandSpec[] = ALL_COMMANDS
): Promise<number> {
  let activeContext: CliContext | undefined
  // Commander's own stderr (usage errors, error-mode help) is buffered so
  // JSON mode can replace it with a structured envelope instead of mixing
  // free text and JSON on the same stream.
  const commanderStderr: string[] = []
  const program = buildProgram(
    io,
    argv,
    (ctx) => {
      activeContext = ctx
    },
    commands,
    (text) => {
      commanderStderr.push(text)
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
    return EXIT_OK
  } catch (error) {
    if (error instanceof CommanderError) {
      const ctx = activeContext ?? makeFallbackContext(io, argv)
      return handleCommanderError(error, ctx, flushCommanderStderr)
    }
    flushCommanderStderr()
    const ctx = activeContext ?? makeFallbackContext(io, argv)
    printError(ctx, error)
    return toExitCode(error)
  }
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
  onContext?: (ctx: CliContext) => void,
  commands: readonly CommandSpec[] = ALL_COMMANDS,
  errSink?: (text: string) => void
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
  for (const spec of commands) {
    registerCommand(program, spec, io, rawArgv, onContext)
  }
  return program
}

function registerCommand(
  program: Command,
  spec: CommandSpec,
  io: CliIo,
  rawArgv: readonly string[],
  onContext?: (ctx: CliContext) => void
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
    const ctx = makeContext({ io, flags, rawArgv })
    onContext?.(ctx)
    const invocation = { ctx, args: positional, flags }
    await enforceConfirmation(spec, invocation)
    const outcome = await spec.run(invocation)
    if (outcome !== undefined) {
      printData(ctx, outcome.data, outcome.human)
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
    lines.push('Credits: this operation consumes Brew credits.')
  }
  lines.push('', 'Examples:')
  for (const example of spec.examples) {
    lines.push(`  ${example}`)
  }
  lines.push('')
  return lines.join('\n')
}
