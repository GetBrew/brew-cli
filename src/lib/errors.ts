import {
  BrewApiError,
  BrewConnectionError,
  BrewTimeoutError,
} from '@brew.new/sdk'
import type { DrainProgress, RecordedRequest } from './transport'
import type { CliContext } from './types'

export const EXIT_OK = 0
export const EXIT_RUNTIME = 1
export const EXIT_USAGE = 2
export const EXIT_AUTH = 3
export const EXIT_CONFIRM = 4
/** 128 + SIGINT, as a shell reports a Ctrl-C'd process. */
export const EXIT_INTERRUPTED = 130
/** 128 + SIGTERM, as a shell reports a terminated process. */
export const EXIT_TERMINATED = 143

export type InterruptSignal = 'SIGINT' | 'SIGTERM'

export function exitCodeForSignal(signal: InterruptSignal): number {
  return signal === 'SIGINT' ? EXIT_INTERRUPTED : EXIT_TERMINATED
}

/**
 * The process received SIGINT or SIGTERM. It is the abort REASON of the
 * command's signal, so the SDK and the raw transport rethrow it as-is.
 */
export class CliInterruptError extends Error {
  readonly signal: InterruptSignal

  constructor(signal: InterruptSignal) {
    super(signal === 'SIGINT' ? 'Interrupted.' : 'Terminated.')
    this.name = 'CliInterruptError'
    this.signal = signal
  }
}

/**
 * A deadline the CLI owns ran out: the command's `--timeout` (or its
 * default), or one raw attempt's. Named `TimeoutError` like the platform's
 * and the SDK's, so every timeout check agrees.
 */
export class CliTimeoutError extends Error {
  readonly timeoutMs: number

  constructor(timeoutMs: number) {
    super(`No complete response within ${timeoutMs}ms.`)
    this.name = 'TimeoutError'
    this.timeoutMs = timeoutMs
  }
}

/** A raw request's connection failed or dropped before the body arrived. */
export class CliConnectionError extends Error {
  constructor(cause: unknown) {
    super('The connection failed before a complete response arrived.', {
      cause,
    })
    this.name = 'CliConnectionError'
  }
}

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
 * Error raised by the `api` escape hatch and the raw transport, mirroring
 * the public API error envelope so it renders and exits exactly like a
 * `BrewApiError`.
 */
export class CliApiError extends Error {
  readonly status: number
  readonly code: string
  readonly type: string
  readonly param: string | undefined
  readonly suggestion: string | undefined
  readonly docs: string | undefined
  readonly requestId: string | undefined
  /**
   * The envelope's `details` object when the API sent one — for a
   * trigger-fire `payload_mismatch` that is `{ errors[], warnings[],
   * payloadSchema, … }`, naming every field the payload got wrong.
   */
  readonly details: Record<string, unknown> | undefined
  /** The parsed response body exactly as received (`undefined` if not JSON). */
  readonly body: unknown

  constructor(input: {
    readonly status: number
    readonly code: string
    readonly type: string
    readonly message: string
    readonly param?: string
    readonly suggestion?: string
    readonly docs?: string
    readonly requestId?: string
    readonly details?: Record<string, unknown>
    readonly body?: unknown
  }) {
    super(input.message)
    this.status = input.status
    this.code = input.code
    this.type = input.type
    this.param = input.param
    this.suggestion = input.suggestion
    this.docs = input.docs
    this.requestId = input.requestId
    this.details = input.details
    this.body = input.body
  }
}

/**
 * The closest API error `type` for a response that did not carry one — the
 * legacy fire envelope never does, and neither does a non-JSON body. Every
 * 4xx is a client-side problem (an unlisted one, `405` or `415` say, is
 * still `invalid_request`); only a 5xx is an `internal_error`.
 */
export function errorTypeForStatus(status: number): string {
  switch (status) {
    case 401:
      return 'authentication_error'
    case 402:
      return 'payment_required'
    case 403:
      return 'authorization_error'
    case 404:
      return 'not_found'
    case 409:
      return 'conflict'
    case 429:
      return 'rate_limit'
    case 501:
      return 'not_implemented'
    case 503:
      return 'service_unavailable'
    default:
      return status >= 400 && status < 500
        ? 'invalid_request'
        : 'internal_error'
  }
}

/**
 * Retry advice is only honest for the statuses the SDK's retry policy
 * retries — `408`, `429` and 5xx — so a raw call (single-attempt) and a
 * typed call give the same guidance for the same status. Any other 4xx
 * fails the same way on every retry.
 */
export function suggestionForStatus(status: number): string {
  if (status === 408 || status === 429 || status >= 500) {
    return 'Retry the request. If it keeps failing, contact support.'
  }
  return 'Fix the request before sending it again — the same request fails the same way. See `details` for the specifics when present.'
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
  if (error instanceof CliInterruptError) {
    return exitCodeForSignal(error.signal)
  }
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
  /** The API's `details` object, verbatim, when the refusal carried one. */
  readonly details?: Record<string, unknown>
  readonly status?: number
  /**
   * When the outcome of a replaying write is unknown (a timeout, a dropped
   * connection, an interrupt, a 5xx): the key its request carried, and the
   * command that replays it instead of running it twice.
   */
  readonly idempotencyKey?: string
  readonly retryCommand?: string
  /** How far an interrupted `--all` drain got, and the cursor to resume at. */
  readonly progress?: DrainProgress
}

/**
 * What the CLI knows about the command that failed, for advice an error
 * alone cannot give: which request it was, whether it only read, whether its
 * route replays a keyed request, and the command line that would replay it.
 */
export type ErrorContext = {
  readonly request?: RecordedRequest
  readonly isRead?: boolean
  /** `true` when the route replays a request carrying the same key. */
  readonly replays?: boolean
  /** Builds the re-run command line for a key. */
  readonly retryCommand?: (idempotencyKey: string) => string
  readonly drain?: DrainProgress
}

export function toErrorEnvelope(
  error: unknown,
  context: ErrorContext = {}
): CliErrorEnvelope {
  const envelope = baseEnvelope(error, context)
  const drain = context.drain
  return withReplayAdvice(
    drain === undefined ? envelope : { ...envelope, progress: drain },
    error,
    context
  )
}

function baseEnvelope(error: unknown, context: ErrorContext): CliErrorEnvelope {
  if (error instanceof CliInterruptError) {
    return {
      code: 'CLI_INTERRUPTED',
      type: 'cancelled',
      message: `${error.signal === 'SIGINT' ? 'Interrupted' : 'Terminated'} (${error.signal}) ${
        context.request === undefined
          ? 'before any request was sent.'
          : `while waiting for ${context.request.method} ${pathOnly(context.request.path)}.`
      }`,
    }
  }
  if (isTimeoutError(error)) {
    return {
      code: 'CLI_TIMEOUT',
      type: 'service_unavailable',
      message: timeoutMessage(error, context),
      suggestion:
        'Retry the request. Reuse the same Idempotency-Key for a POST request.',
    }
  }
  if (
    error instanceof BrewConnectionError ||
    error instanceof CliConnectionError
  ) {
    const cause =
      error.cause instanceof Error && error.cause.message !== ''
        ? `: ${error.cause.message}`
        : ''
    return {
      code: 'CLI_CONNECTION',
      type: 'service_unavailable',
      message:
        error instanceof BrewConnectionError
          ? error.message
          : `${error.message.replace(/\.$/, '')}${
              context.request === undefined
                ? ''
                : ` (${context.request.method} ${pathOnly(context.request.path)})`
            }${cause}.`,
      suggestion: 'Check the connection and retry the request.',
    }
  }
  if (error instanceof BrewApiError || error instanceof CliApiError) {
    const details = readErrorDetails(error)
    return {
      code: error.code,
      type: error.type,
      message: error.message,
      ...(error.param ? { param: error.param } : {}),
      ...(error.suggestion ? { suggestion: error.suggestion } : {}),
      ...(error.docs ? { docs: error.docs } : {}),
      ...(error.requestId ? { requestId: error.requestId } : {}),
      ...(details === undefined ? {} : { details }),
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
  let message = error instanceof Error ? error.message : String(error)
  if (error instanceof Error && error.cause !== undefined) {
    const cause =
      error.cause instanceof Error ? error.cause.message : String(error.cause)
    message = `${message} (${cause})`
  }
  return { code: 'CLI_UNEXPECTED', type: 'internal_error', message }
}

const IN_PROGRESS_CODE = 'IDEMPOTENCY_IN_PROGRESS'

/**
 * Advice for an UNKNOWN outcome — a timeout, a dropped connection, an
 * interrupt, a 5xx, or the API saying the first attempt is still running.
 * The server keeps working after the CLI disconnects, so a write may still
 * complete: the only safe re-run is one that replays it with the same key.
 * A definite answer (any other 4xx, a conflict that needs a NEW key) gets
 * no key: replaying it would fail the same way.
 */
function withReplayAdvice(
  envelope: CliErrorEnvelope,
  error: unknown,
  context: ErrorContext
): CliErrorEnvelope {
  if (!isUnknownOutcome(envelope)) {
    return envelope
  }
  const isInProgress =
    envelope.code === IN_PROGRESS_CODE ||
    (error instanceof BrewTimeoutError && error.inProgress) ||
    (error instanceof BrewConnectionError && error.inProgress)
  const holdNote = isInProgress
    ? ' The first attempt is still running on the server, which holds its key for up to 15 minutes: until then a replay answers 409 IDEMPOTENCY_IN_PROGRESS, so wait and re-run.'
    : ''
  if (context.request === undefined) {
    return envelope.code === 'CLI_INTERRUPTED'
      ? { ...envelope, suggestion: 'Nothing was sent.' }
      : envelope
  }
  if (context.isRead === true || context.request.method === 'GET') {
    return envelope.code === 'CLI_INTERRUPTED'
      ? { ...envelope, suggestion: 'It only reads; nothing was changed.' }
      : envelope
  }
  const key = errorIdempotencyKey(error) ?? context.request.idempotencyKey
  if (context.replays !== true || key === undefined) {
    return {
      ...envelope,
      suggestion: `${pathOnly(context.request.path)} may already have been changed, and this route does not replay a request: check its current state before running it again.`,
    }
  }
  const retryCommand = context.retryCommand?.(key)
  return {
    ...envelope,
    suggestion: `The API keeps working after the CLI disconnects, so this may still complete. Re-run with --idempotency-key ${key} to get its result instead of running it twice (the key replays for 24 hours).${holdNote}`,
    idempotencyKey: key,
    ...(retryCommand === undefined ? {} : { retryCommand }),
  }
}

function isUnknownOutcome(envelope: CliErrorEnvelope): boolean {
  if (
    envelope.code === 'CLI_INTERRUPTED' ||
    envelope.code === 'CLI_TIMEOUT' ||
    envelope.code === 'CLI_CONNECTION' ||
    envelope.code === IN_PROGRESS_CODE
  ) {
    return true
  }
  return envelope.status !== undefined && envelope.status >= 500
}

function errorIdempotencyKey(error: unknown): string | undefined {
  if (
    error instanceof BrewApiError ||
    error instanceof BrewTimeoutError ||
    error instanceof BrewConnectionError
  ) {
    return error.idempotencyKey
  }
  return undefined
}

function timeoutMessage(error: unknown, context: ErrorContext): string {
  if (error instanceof BrewTimeoutError) {
    return error.message
  }
  if (error instanceof CliTimeoutError) {
    const request = context.request
    return request === undefined
      ? error.message
      : `${error.message.replace(/\.$/, '')} (${request.method} ${pathOnly(request.path)}).`
  }
  return 'The request timed out before the API responded.'
}

/** Drop the query string: it can carry an email address. */
function pathOnly(path: string): string {
  return path.split('?')[0] ?? path
}

export function printError(
  ctx: CliContext,
  error: unknown,
  context: ErrorContext = {}
): void {
  if (error instanceof ConfirmationRequiredError) {
    ctx.io.stdout.write(`${JSON.stringify(error.envelope)}\n`)
    if (ctx.mode === 'human') {
      ctx.io.stderr.write(
        `Confirmation required. Review, then re-run to proceed:\n  ${error.envelope.confirmCommand}\n`
      )
    }
    return
  }
  const envelope = toErrorEnvelope(error, context)
  if (ctx.mode === 'json') {
    ctx.io.stderr.write(`${JSON.stringify({ error: envelope })}\n`)
    return
  }
  const lines = [
    `brew-cli: ${envelope.message}`,
    ...formatDetailLines(envelope.details),
  ]
  if (envelope.suggestion) {
    lines.push(envelope.suggestion)
  }
  if (envelope.retryCommand) {
    lines.push(`Re-run: ${envelope.retryCommand}`)
  }
  if (envelope.progress) {
    const { rowsFetched, pagesFetched, resumeCursor } = envelope.progress
    lines.push(
      `Fetched ${rowsFetched} rows in ${pagesFetched} pages before stopping${
        resumeCursor === undefined
          ? '.'
          : `; resume with --cursor ${resumeCursor} --all.`
      }`
    )
  }
  if (envelope.docs) {
    lines.push(`Docs: ${envelope.docs}`)
  }
  if (envelope.requestId) {
    lines.push(`Request id: ${envelope.requestId}`)
  }
  ctx.io.stderr.write(`${lines.join('\n')}\n`)
}

/**
 * `details` read structurally off either error class. `BrewApiError`
 * exposes it from `@brew.new/sdk` 9.3 on; older SDKs simply have none, so
 * the typed commands light up on the SDK bump with no CLI change.
 */
function readErrorDetails(error: object): Record<string, unknown> | undefined {
  const details = (error as { details?: unknown }).details
  return isRecord(details) ? details : undefined
}

/**
 * Human-mode rendering of `details`. A field-error list (the trigger-fire
 * `payload_mismatch` shape, `errors: [{ field, message, expectedType?,
 * actualType? }]`) becomes one line per field; any other shape is one JSON
 * line, so nothing the API said is hidden.
 */
function formatDetailLines(
  details: Record<string, unknown> | undefined
): string[] {
  if (details === undefined) {
    return []
  }
  const issues = details.errors
  if (Array.isArray(issues) && issues.length > 0 && issues.every(isIssue)) {
    return issues.map((issue) => {
      const types =
        typeof issue.expectedType === 'string'
          ? typeof issue.actualType === 'string'
            ? ` (expected ${issue.expectedType}, got ${issue.actualType})`
            : ` (expected ${issue.expectedType})`
          : ''
      return `  - ${issue.field}: ${issue.message}${types}`
    })
  }
  return [`Details: ${JSON.stringify(details)}`]
}

function isIssue(
  value: unknown
): value is Record<string, unknown> & { field: string; message: string } {
  return (
    isRecord(value) &&
    typeof value.field === 'string' &&
    typeof value.message === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function apiErrorStatus(error: unknown): number | undefined {
  if (error instanceof BrewApiError || error instanceof CliApiError) {
    return error.status
  }
}

/**
 * The SDK's `BrewTimeoutError`, the CLI's own `CliTimeoutError`, and the
 * platform's `AbortSignal.timeout` DOMException all name themselves
 * `TimeoutError`.
 */
export function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof BrewTimeoutError ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'TimeoutError')
  )
}
