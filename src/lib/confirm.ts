import type { CommandInvocation, CommandSpec } from './define-command'
import { CommandAbortedError, ConfirmationRequiredError } from './errors'
import { getInvocationPrefix } from './invocation'
import { buildRerunCommand, type RerunInvocation } from './rerun'

export { shellQuote } from './rerun'

/**
 * The confirmation protocol for destructive commands:
 * - `--yes` proceeds unconditionally.
 * - An interactive human session gets a y/N prompt.
 * - Everything else (agents, pipes, CI) receives exit code 4 and a JSON
 *   envelope on stdout whose `confirmCommand` re-runs the call with --yes.
 */
export async function enforceConfirmation(
  spec: CommandSpec,
  invocation: CommandInvocation,
  options: { readonly confirmationInput?: string } = {}
): Promise<void> {
  if (!spec.confirmSummary) {
    return
  }
  const summary = spec.confirmSummary({
    args: invocation.args,
    flags: invocation.flags,
    ...(invocation.input === undefined ? {} : { input: invocation.input }),
  })
  if (summary === undefined) {
    return
  }
  const { ctx } = invocation
  ctx.signal.throwIfAborted()
  if (ctx.globals.yes) {
    return
  }
  if (ctx.mode === 'human' && ctx.io.isTtyIn) {
    const resumeDeadline = ctx.pauseDeadline()
    try {
      ctx.signal.throwIfAborted()
      const answer = await ctx.io.readLine(`${summary}\nProceed? [y/N] `)
      ctx.signal.throwIfAborted()
      const normalized = answer.trim().toLowerCase()
      if (normalized === 'y' || normalized === 'yes') {
        return
      }
      throw new CommandAbortedError('Aborted.')
    } catch (error) {
      ctx.signal.throwIfAborted()
      throw error
    } finally {
      resumeDeadline()
    }
  }
  const prefix = getInvocationPrefix(ctx.io.env)
  throw new ConfirmationRequiredError({
    confirmationRequired: true,
    command: [prefix, ...spec.path].join(' '),
    summary,
    confirmCommand: buildConfirmCommand(
      invocation,
      spec,
      options.confirmationInput ??
        (invocation.flags.input === '-' && invocation.input !== undefined
          ? JSON.stringify(invocation.input)
          : undefined),
      prefix
    ),
  })
}

/**
 * `prefix` is how the CLI was invoked (`getInvocationPrefix`): `brew-cli`,
 * or a package runner such as `npx -y @brew.new/cli@<version>`.
 */
export function buildConfirmCommand(
  invocation: RerunInvocation,
  command: Pick<CommandSpec, 'path' | 'flags' | 'args'>,
  inlineInput?: string,
  prefix?: string
): string {
  return buildRerunCommand(command, invocation, {
    yes: true,
    ...(inlineInput === undefined ? {} : { inlineInput }),
    ...(prefix === undefined ? {} : { prefix }),
  })
}

/** Confirm stdin requests after parsing, carrying the merged body on a re-run. */
export async function enforceStdinConfirmation(
  spec: CommandSpec,
  invocation: CommandInvocation,
  input: Readonly<Record<string, unknown>>
): Promise<void> {
  if (invocation.flags.input !== '-') {
    return
  }
  const serializedInput = JSON.stringify(input)
  await enforceConfirmation(
    spec,
    { ...invocation, flags: { ...invocation.flags, input: serializedInput } },
    {
      confirmationInput: serializedInput,
    }
  )
}

/** Replay the same parsed invocation with the key carried by its request. */
export function buildRetryCommand(
  invocation: RerunInvocation,
  idempotencyKey: string,
  command: Pick<CommandSpec, 'path' | 'flags' | 'args'>,
  prefix?: string
): string {
  return buildRerunCommand(command, invocation, {
    idempotencyKey,
    ...(prefix === undefined ? {} : { prefix }),
  })
}

/** Resume only finalization; repeating the file helper opens a new upload. */
export function buildUploadRetryCommand(
  input: {
    readonly uploadId: string
    readonly idempotencyKey: string
    readonly brand: string | undefined
    readonly apiUrl: string | undefined
  },
  command: Pick<CommandSpec, 'path' | 'flags' | 'args'>,
  prefix?: string
): string {
  return buildRerunCommand(
    command,
    {
      args: {},
      flags: {
        uploadId: input.uploadId,
        brand: input.brand,
        apiUrl: input.apiUrl,
      },
    },
    {
      idempotencyKey: input.idempotencyKey,
      ...(prefix === undefined ? {} : { prefix }),
    }
  )
}
