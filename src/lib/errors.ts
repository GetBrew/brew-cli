import { BrewApiError } from '@brew.new/sdk'
import type { CliContext } from './types'

export const EXIT_OK = 0
export const EXIT_RUNTIME = 1
export const EXIT_USAGE = 2
export const EXIT_AUTH = 3
export const EXIT_CONFIRM = 4

/** Bad invocation: malformed input, unusable flag combinations. */
export class CliUsageError extends Error {}

/** Missing or unusable credentials, detected before any request is sent. */
export class CliAuthError extends Error {
  readonly suggestion: string

  constructor(message: string, suggestion: string) {
    super(message)
    this.suggestion = suggestion
  }
}

/** The user declined an interactive confirmation prompt. */
export class CommandAbortedError extends Error {}

/**
 * Error raised by the `api` escape hatch, mirroring the public API error
 * envelope so it renders and exits exactly like a `BrewApiError`.
 */
export class CliApiError extends Error {
  readonly status: number
  readonly code: string
  readonly type: string
  readonly param: string | undefined
  readonly suggestion: string | undefined
  readonly docs: string | undefined
  readonly requestId: string | undefined

  constructor(input: {
    readonly status: number
    readonly code: string
    readonly type: string
    readonly message: string
    readonly param?: string
    readonly suggestion?: string
    readonly docs?: string
    readonly requestId?: string
  }) {
    super(input.message)
    this.status = input.status
    this.code = input.code
    this.type = input.type
    this.param = input.param
    this.suggestion = input.suggestion
    this.docs = input.docs
    this.requestId = input.requestId
  }
}

export type ConfirmationEnvelope = {
  readonly confirmationRequired: true
  readonly command: string
  readonly summary: string
  readonly confirmCommand: string
}

/**
 * A destructive command ran without --yes in a non-interactive session.
 * The envelope is the command's machine-readable response: the caller
 * shows `summary` to a human and re-runs `confirmCommand` to proceed.
 */
export class ConfirmationRequiredError extends Error {
  readonly envelope: ConfirmationEnvelope

  constructor(envelope: ConfirmationEnvelope) {
    super(envelope.summary)
    this.envelope = envelope
  }
}

export function toExitCode(error: unknown): number {
  if (error instanceof ConfirmationRequiredError) {
    return EXIT_CONFIRM
  }
  if (error instanceof CliUsageError) {
    return EXIT_USAGE
  }
  if (error instanceof CliAuthError) {
    return EXIT_AUTH
  }
  const status = apiErrorStatus(error)
  if (status === 401 || status === 403) {
    return EXIT_AUTH
  }
  return EXIT_RUNTIME
}

export type CliErrorEnvelope = {
  readonly code: string
  readonly type: string
  readonly message: string
  readonly param?: string
  readonly suggestion?: string
  readonly docs?: string
  readonly requestId?: string
  readonly status?: number
}

export function toErrorEnvelope(error: unknown): CliErrorEnvelope {
  if (error instanceof BrewApiError || error instanceof CliApiError) {
    return {
      code: error.code,
      type: error.type,
      message: error.message,
      ...(error.param ? { param: error.param } : {}),
      ...(error.suggestion ? { suggestion: error.suggestion } : {}),
      ...(error.docs ? { docs: error.docs } : {}),
      ...(error.requestId ? { requestId: error.requestId } : {}),
      status: error.status,
    }
  }
  if (error instanceof CliAuthError) {
    return {
      code: 'CLI_AUTH',
      type: 'authentication_error',
      message: error.message,
      suggestion: error.suggestion,
    }
  }
  if (error instanceof CliUsageError) {
    return {
      code: 'CLI_USAGE',
      type: 'invalid_request',
      message: error.message,
    }
  }
  if (error instanceof CommandAbortedError) {
    return {
      code: 'CLI_ABORTED',
      type: 'invalid_request',
      message: error.message === '' ? 'Aborted.' : error.message,
    }
  }
  const message = error instanceof Error ? error.message : String(error)
  return { code: 'CLI_UNEXPECTED', type: 'internal_error', message }
}

export function printError(ctx: CliContext, error: unknown): void {
  if (error instanceof ConfirmationRequiredError) {
    ctx.io.stdout.write(`${JSON.stringify(error.envelope)}\n`)
    if (ctx.mode === 'human') {
      ctx.io.stderr.write(
        `Confirmation required. Review, then re-run to proceed:\n  ${error.envelope.confirmCommand}\n`
      )
    }
    return
  }
  const envelope = toErrorEnvelope(error)
  if (ctx.mode === 'json') {
    ctx.io.stderr.write(`${JSON.stringify({ error: envelope })}\n`)
    return
  }
  const lines = [`brew-cli: ${envelope.message}`]
  if (envelope.suggestion) {
    lines.push(envelope.suggestion)
  }
  if (envelope.docs) {
    lines.push(`Docs: ${envelope.docs}`)
  }
  if (envelope.requestId) {
    lines.push(`Request id: ${envelope.requestId}`)
  }
  ctx.io.stderr.write(`${lines.join('\n')}\n`)
}

function apiErrorStatus(error: unknown): number | undefined {
  if (error instanceof BrewApiError || error instanceof CliApiError) {
    return error.status
  }
}
