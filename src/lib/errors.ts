import {
  BrewApiError,
  BrewConnectionError,
  BrewParseError,
  BrewTimeoutError,
  BrewTransportError,
} from '@brew.new/sdk'
import { readImageUploadId } from './image-upload-recovery'
import type { DrainProgress, RecordedRequest } from './transport'
import type { CliContext } from './types'

export const EXIT_OK = 0
export const EXIT_RUNTIME = 1
export const EXIT_USAGE = 2
export const EXIT_AUTH = 3
export const EXIT_CONFIRM = 4
export const EXIT_INTERRUPTED = 130
export const EXIT_TERMINATED = 143

export class CliPaginationError extends Error {
  readonly cursor: string

  constructor(cursor: string) {
    super('Pagination returned a previously fetched cursor.')
    this.name = 'CliPaginationError'
    this.cursor = cursor
  }
}

export type InterruptSignal = 'SIGINT' | 'SIGTERM'

export function exitCodeForSignal(signal: InterruptSignal): number {
  return signal === 'SIGINT' ? EXIT_INTERRUPTED : EXIT_TERMINATED
}

export class CliInterruptError extends Error {
  readonly signal: InterruptSignal

  constructor(signal: InterruptSignal) {
    super(signal === 'SIGINT' ? 'Interrupted.' : 'Terminated.')
    this.name = 'CliInterruptError'
    this.signal = signal
  }
}

export class CliTimeoutError extends Error {
  readonly timeoutMs: number

  constructor(timeoutMs: number) {
    super(`No complete response within ${timeoutMs}ms.`)
    this.name = 'TimeoutError'
    this.timeoutMs = timeoutMs
  }
}

export class CliConnectionError extends Error {
  constructor(cause: unknown) {
    super('The connection failed before a complete response arrived.', {
      cause,
    })
    this.name = 'CliConnectionError'
  }
}

export class CliUsageError extends Error {}

export class CliAuthError extends Error {
  readonly suggestion: string

  constructor(message: string, suggestion: string) {
    super(message)
    this.suggestion = suggestion
  }
}

export class CommandAbortedError extends Error {}

export class CliApiError extends Error {
  readonly status: number
  readonly code: string
  readonly type: string
  readonly param: string | undefined
  readonly suggestion: string | undefined
  readonly docs: string | undefined
  readonly requestId: string | undefined
  readonly details: Record<string, unknown> | undefined
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
  readonly details?: Record<string, unknown>
  readonly status?: number
  readonly idempotencyKey?: string
  readonly uploadId?: string
  readonly retryCommand?: string
  readonly progress?: DrainProgress
}

export type ErrorContext = {
  readonly request?: RecordedRequest
  readonly isRead?: boolean
  readonly replays?: boolean
  readonly retryCommand?: (idempotencyKey: string) => string
  readonly retryUploadCommand?: (
    uploadId: string,
    idempotencyKey: string
  ) => string
  readonly readsStdin?: boolean
  readonly drain?: DrainProgress
}

export function toErrorEnvelope(
  error: unknown,
  context: ErrorContext = {}
): CliErrorEnvelope {
  const envelope = baseEnvelope(error, context)
  const drain = context.drain
  const withProgress =
    drain === undefined ? envelope : { ...envelope, progress: drain }
  return (
    withUploadReplayAdvice(withProgress, error, context) ??
    withReplayAdvice(withProgress, error, context)
  )
}

function baseEnvelope(error: unknown, context: ErrorContext): CliErrorEnvelope {
  if (error instanceof CliPaginationError) {
    return {
      code: 'CLI_PAGINATION',
      type: 'internal_error',
      message: error.message,
      suggestion:
        'Report the pagination failure. The list is incomplete; a cyclic cursor cannot safely resume it.',
      details: { cursor: error.cursor },
    }
  }
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
  if (error instanceof BrewParseError) {
    return {
      code: 'UNEXPECTED_RESPONSE',
      type: 'internal_error',
      message: error.message,
      status: error.status,
      ...(error.requestId === undefined ? {} : { requestId: error.requestId }),
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

function withUploadReplayAdvice(
  envelope: CliErrorEnvelope,
  error: unknown,
  context: ErrorContext
): CliErrorEnvelope | undefined {
  const sdkUploadId =
    isSdkRequestError(error) && 'uploadId' in error
      ? readImageUploadId(error.uploadId)
      : undefined
  const uploadId = sdkUploadId ?? context.request?.uploadId
  if (uploadId === undefined) return undefined
  const idempotencyKey =
    errorIdempotencyKey(error) ?? context.request?.idempotencyKey
  const recovery = {
    ...envelope,
    uploadId,
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
  }
  if (
    idempotencyKey === undefined ||
    (!isUnknownOutcome(envelope) &&
      envelope.code !== 'UPLOAD_IN_PROGRESS' &&
      envelope.code !== 'UNEXPECTED_RESPONSE')
  ) {
    return recovery
  }
  const retryCommand = context.retryUploadCommand?.(uploadId, idempotencyKey)
  const holdNote =
    envelope.code === 'UPLOAD_IN_PROGRESS' ||
    envelope.code === IN_PROGRESS_CODE ||
    (error instanceof BrewTransportError && error.inProgress)
      ? ' Wait for the current attempt to finish before replaying finalization.'
      : ''
  return {
    ...recovery,
    suggestion: `Recover the original image finalization with content add-image, using the original upload ID and idempotency key on the same brand. A completed upload replays its result for 24 hours. Repeating content upload-image opens a new upload.${holdNote}`,
    ...(retryCommand === undefined ? {} : { retryCommand }),
  }
}

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
      suggestion: `${pathOnly(context.request.path)} may already have been changed, and this command does not replay a request: check its current state before running it again.`,
    }
  }
  const retryCommand = context.retryCommand?.(key)
  return {
    ...envelope,
    suggestion: `The API keeps working after the CLI disconnects, so this may still complete. Re-run with --idempotency-key ${key} to get its result instead of running it twice (the key replays for 24 hours${context.readsStdin === true ? '; pipe the same input to it again' : ''}).${holdNote}`,
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
  if (isSdkRequestError(error) && 'idempotencyKey' in error) {
    const key = error.idempotencyKey
    return typeof key === 'string' ? key : undefined
  }
  return undefined
}

function isSdkRequestError(
  error: unknown
): error is BrewApiError | BrewTransportError | BrewParseError {
  return (
    error instanceof BrewApiError ||
    error instanceof BrewTransportError ||
    error instanceof BrewParseError
  )
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
  if (envelope.uploadId) {
    lines.push(`Upload id: ${envelope.uploadId}`)
    if (envelope.idempotencyKey) {
      lines.push(`Idempotency key: ${envelope.idempotencyKey}`)
    }
  }
  if (envelope.retryCommand) {
    lines.push(`Re-run: ${envelope.retryCommand}`)
  }
  if (envelope.progress) {
    const { rowsFetched, pagesFetched, resumeCursor, resumeWith } =
      envelope.progress
    const resume =
      resumeWith ??
      (resumeCursor === undefined
        ? undefined
        : `--cursor ${resumeCursor} --all`)
    lines.push(
      `Fetched ${rowsFetched} rows in ${pagesFetched} pages before stopping${
        resume === undefined ? '.' : `; resume with ${resume}.`
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

function readErrorDetails(error: object): Record<string, unknown> | undefined {
  const details = (error as { details?: unknown }).details
  return isRecord(details) ? details : undefined
}

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

export function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof BrewTimeoutError ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'TimeoutError')
  )
}
