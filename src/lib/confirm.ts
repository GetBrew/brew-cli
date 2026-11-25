import type { CommandInvocation, CommandSpec } from './define-command'
import { CommandAbortedError, ConfirmationRequiredError } from './errors'
import { buildRerunCommand, type RerunInvocation } from './rerun'

export { shellQuote } from './rerun'

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
  throw new ConfirmationRequiredError({
    confirmationRequired: true,
    command: ['brew-cli', ...spec.path].join(' '),
    summary,
    confirmCommand: buildConfirmCommand(
      invocation,
      spec,
      options.confirmationInput ??
        (invocation.flags.input === '-' && invocation.input !== undefined
          ? JSON.stringify(invocation.input)
          : undefined)
    ),
  })
}

export function buildConfirmCommand(
  invocation: RerunInvocation,
  command: Pick<CommandSpec, 'path' | 'flags' | 'args'>,
  inlineInput?: string
): string {
  return buildRerunCommand(command, invocation, {
    yes: true,
    ...(inlineInput === undefined ? {} : { inlineInput }),
  })
}

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

export function buildRetryCommand(
  invocation: RerunInvocation,
  idempotencyKey: string,
  command: Pick<CommandSpec, 'path' | 'flags' | 'args'>
): string {
  return buildRerunCommand(command, invocation, {
    idempotencyKey,
  })
}

export function buildUploadRetryCommand(
  input: {
    readonly uploadId: string
    readonly idempotencyKey: string
    readonly brand: string | undefined
    readonly apiUrl: string | undefined
  },
  command: Pick<CommandSpec, 'path' | 'flags' | 'args'>
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
    { idempotencyKey: input.idempotencyKey }
  )
}
