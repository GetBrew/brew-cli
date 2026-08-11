import type { CommandInvocation, CommandSpec } from './define-command'
import { CommandAbortedError, ConfirmationRequiredError } from './errors'

/**
 * The confirmation protocol for destructive commands:
 * - `--yes` proceeds unconditionally.
 * - An interactive human session gets a y/N prompt.
 * - Everything else (agents, pipes, CI) receives exit code 4 and a JSON
 *   envelope on stdout whose `confirmCommand` re-runs the call with --yes.
 */
export async function enforceConfirmation(
  spec: CommandSpec,
  invocation: CommandInvocation
): Promise<void> {
  if (!spec.confirmSummary) {
    return
  }
  const summary = spec.confirmSummary({
    args: invocation.args,
    flags: invocation.flags,
  })
  if (summary === undefined) {
    return
  }
  const { ctx } = invocation
  if (ctx.globals.yes) {
    return
  }
  if (ctx.mode === 'human' && ctx.io.isTtyIn) {
    const answer = await ctx.io.readLine(`${summary}\nProceed? [y/N] `)
    const normalized = answer.trim().toLowerCase()
    if (normalized === 'y' || normalized === 'yes') {
      return
    }
    throw new CommandAbortedError('Aborted.')
  }
  throw new ConfirmationRequiredError({
    confirmationRequired: true,
    command: ['brew-cli', ...spec.path].join(' '),
    summary,
    confirmCommand: buildConfirmCommand(ctx.rawArgv),
  })
}

export function buildConfirmCommand(rawArgv: readonly string[]): string {
  // The envelope goes to stdout and into agent transcripts — never echo a
  // raw credential back. The re-run resolves the key from env/config.
  const tokens: string[] = []
  for (let index = 0; index < rawArgv.length; index += 1) {
    const token = rawArgv[index]
    if (token === undefined) {
      continue
    }
    if (token === '--api-key') {
      index += 1
      continue
    }
    if (token.startsWith('--api-key=')) {
      continue
    }
    tokens.push(shellQuote(token))
  }
  return ['brew-cli', ...tokens, '--yes'].join(' ')
}

function shellQuote(token: string): string {
  if (/^[A-Za-z0-9@%+=:,./_-]+$/.test(token)) {
    return token
  }
  return `'${token.replaceAll("'", String.raw`'\''`)}'`
}
