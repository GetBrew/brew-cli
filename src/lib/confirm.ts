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
  return ['brew-cli', ...rerunTokens(rawArgv), '--yes'].join(' ')
}

/**
 * The command line that replays an interrupted or timed-out write: the same
 * argv with the idempotency key its request carried, so the API returns the
 * first attempt's result instead of running it again.
 */
export function buildRetryCommand(
  rawArgv: readonly string[],
  idempotencyKey: string
): string {
  return [
    'brew-cli',
    ...rerunTokens(rawArgv, { dropIdempotencyKey: true }),
    '--idempotency-key',
    shellQuote(idempotencyKey),
  ].join(' ')
}

/**
 * argv, shell-quoted, for a command the caller will run again. Both
 * envelopes go to stdout and into agent transcripts, so a credential is
 * never echoed back: `--api-key` goes (the re-run resolves the key from env
 * or config) and so does any credential header passed to `api --header`.
 */
function rerunTokens(
  rawArgv: readonly string[],
  options: { readonly dropIdempotencyKey?: boolean } = {}
): string[] {
  const tokens: string[] = []
  for (let index = 0; index < rawArgv.length; index += 1) {
    const token = rawArgv[index]
    if (token === undefined) {
      continue
    }
    if (
      token === '--api-key' ||
      (options.dropIdempotencyKey === true && token === '--idempotency-key')
    ) {
      index += 1
      continue
    }
    if (
      token.startsWith('--api-key=') ||
      (options.dropIdempotencyKey === true &&
        token.startsWith('--idempotency-key='))
    ) {
      continue
    }
    if (token.startsWith('--header=')) {
      if (!isCredentialHeader(token.slice('--header='.length))) {
        tokens.push(shellQuote(token))
      }
      continue
    }
    if (token === '--header') {
      // Variadic: every value up to the next flag belongs to it.
      const values: string[] = []
      while (
        index + 1 < rawArgv.length &&
        !(rawArgv[index + 1] ?? '').startsWith('-')
      ) {
        index += 1
        const value = rawArgv[index] ?? ''
        if (!isCredentialHeader(value)) {
          values.push(shellQuote(value))
        }
      }
      if (values.length > 0) {
        tokens.push('--header', ...values)
      }
      continue
    }
    tokens.push(shellQuote(token))
  }
  return tokens
}

/**
 * A header whose NAME says it can carry a credential: `Authorization` and
 * `Proxy-Authorization`, cookies, and any name mentioning an API key, auth,
 * a token, secret, password, session or signature. Dropping a harmless
 * header from a re-run costs less than printing a secret into a transcript.
 * `Idempotency-Key` is not a credential: the re-run needs it.
 */
const CREDENTIAL_HEADER_NAME =
  /authorization|cookie|api-?key|auth|token|secret|passw(or)?d|session|signature|credential/i

function isCredentialHeader(header: string): boolean {
  const name = /^\s*([^:\s]+)\s*:/.exec(header)?.[1]
  return name !== undefined && CREDENTIAL_HEADER_NAME.test(name)
}

/** `token` as one shell word: as-is when safe, else single-quoted. */
export function shellQuote(token: string): string {
  if (/^[A-Za-z0-9@%+=:,./_-]+$/.test(token)) {
    return token
  }
  return `'${token.replaceAll("'", String.raw`'\''`)}'`
}
