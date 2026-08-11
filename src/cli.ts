import { Command, CommanderError } from 'commander'
import { enforceConfirmation } from './lib/confirm'
import { makeContext, makeFallbackContext } from './lib/context'
import type { CommandSpec } from './lib/define-command'
import { GLOBAL_FLAGS } from './lib/define-command'
import { EXIT_OK, EXIT_USAGE, printError, toExitCode } from './lib/errors'
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
  'audience-runs': 'Audience-triggered run history and control',
  sends__analytics: 'Send-level delivery reads',
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
  const program = buildProgram(
    io,
    argv,
    (ctx) => {
      activeContext = ctx
    },
    commands
  )
  try {
    await program.parseAsync([...argv], { from: 'user' })
    return EXIT_OK
  } catch (error) {
    if (error instanceof CommanderError) {
      return commanderExitCode(error)
    }
    const ctx = activeContext ?? makeFallbackContext(io, argv)
    printError(ctx, error)
    return toExitCode(error)
  }
}

export function buildProgram(
  io: CliIo,
  rawArgv: readonly string[],
  onContext?: (ctx: CliContext) => void,
  commands: readonly CommandSpec[] = ALL_COMMANDS
): Command {
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
        io.stderr.write(str)
      },
    })
  program.addHelpText('after', AGENT_HELP_FOOTER)
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
    const flags = command.opts<Record<string, unknown>>()
    const positional = (spec.args ?? []).reduce<Record<string, string>>(
      (acc, arg, index) => {
        const value = actionArgs[index]
        if (typeof value === 'string') {
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

function commanderExitCode(error: CommanderError): number {
  if (
    error.code === 'commander.helpDisplayed' ||
    error.code === 'commander.help' ||
    error.code === 'commander.version'
  ) {
    return EXIT_OK
  }
  return EXIT_USAGE
}
