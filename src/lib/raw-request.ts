import { CLI_NAME, CLI_VERSION } from '../version'
import type { ResolvedAuth } from './client'
import { isOrgLevelPath, resolveAuth } from './client'
import type { HttpMethod } from './define-command'
import {
  CliApiError,
  CliConnectionError,
  CliTimeoutError,
  errorTypeForStatus,
  suggestionForStatus,
} from './errors'
import { anySignal, apiPathOf } from './transport'
import type { CliContext } from './types'

/** A raw attempt's deadline when neither `--timeout` nor a route default applies — the SDK's default. */
export const DEFAULT_ATTEMPT_TIMEOUT_MS = 30_000

/**
 * One raw HTTP attempt, bounded end to end: a deadline that covers the
 * response BODY as well as the headers, the command's signal (interrupt and
 * `--timeout`), and a record of the request for error envelopes. A failure
 * is classified by what aborted, never by the error's name: the command's
 * own reason (interrupt or deadline) is rethrown as-is, this attempt's
 * deadline becomes a `CliTimeoutError`, anything else a `CliConnectionError`.
 */
export async function rawFetch(
  ctx: CliContext,
  request: {
    readonly method: HttpMethod
    readonly url: string
    readonly headers: Headers
    readonly body?: string
    readonly timeoutMs: number
  }
): Promise<{ readonly response: Response; readonly text: string }> {
  const attempt = new AbortController()
  const timer = setTimeout(() => {
    attempt.abort(new CliTimeoutError(request.timeoutMs))
  }, request.timeoutMs)
  const combined = anySignal([ctx.signal, attempt.signal])
  const { signal } = combined
  if (signal.aborted) {
    clearTimeout(timer)
    combined.release()
    throw signal.reason
  }
  ctx.transport.record({
    method: request.method,
    path: apiPathOf(new URL(request.url)),
    idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
  })
  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      signal,
      ...(request.body === undefined ? {} : { body: request.body }),
    })
    return { response, text: await readBodyText(response, signal) }
  } catch (error) {
    if (signal.aborted) {
      throw signal.reason
    }
    throw new CliConnectionError(error)
  } finally {
    clearTimeout(timer)
    combined.release()
  }
}

/**
 * Read a body as text, ending the read the moment `signal` aborts. Cancels
 * its own reader rather than trusting the runtime to error the stream on
 * abort — a mocked body, or a runtime that does not, would otherwise hang
 * past the deadline.
 */
async function readBodyText(
  response: Response,
  signal: AbortSignal
): Promise<string> {
  if (response.body === null) {
    return ''
  }
  const reader = response.body.getReader()
  const onAbort = (): void => {
    reader.cancel(signal.reason).catch(() => undefined)
  }
  signal.addEventListener('abort', onAbort, { once: true })
  const decoder = new TextDecoder()
  let text = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      signal.throwIfAborted()
      if (done) {
        return text + decoder.decode()
      }
      text += decoder.decode(value, { stream: true })
    }
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

/**
 * Minimal typed transport for public-API operations the published SDK does
 * not expose yet. Shares auth resolution, the X-Brand-Id policy, and
 * error-envelope mapping with the `api` escape hatch. Each caller swaps to
 * the SDK method when it ships — the parity-sdk sentinel flags the moment
 * that becomes possible. Unlike the SDK transport, raw calls are
 * single-attempt (no retry loop), bounded by `rawFetch`'s deadline. POST
 * calls get an idempotency key automatically; a timed-out or interrupted
 * one reports that key (and the command that replays it), and callers can
 * pass their own to replay across process restarts.
 */
export async function rawRequest<TResponse>(
  ctx: CliContext,
  request: {
    readonly method: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
    readonly path: string
    readonly body?: unknown
    readonly query?: Readonly<Record<string, string | undefined>>
    readonly idempotencyKey?: string | undefined
    readonly allowAnonymous?: boolean
  }
): Promise<TResponse> {
  const auth = resolveAuth({
    globals: ctx.globals,
    env: ctx.io.env,
    ...(request.allowAnonymous === true ? { allowAnonymous: true } : {}),
  })
  const hasBody = request.body !== undefined
  const idempotencyKey = resolveRawIdempotencyKey(
    request.method,
    request.idempotencyKey
  )
  const headers = buildRawHeaders({
    auth,
    path: request.path,
    hasJsonBody: hasBody,
    idempotencyKey,
  })
  const url = new URL(`${auth.apiUrl}${request.path}`)
  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, value)
    }
  }
  const { response, text } = await rawFetch(ctx, {
    method: request.method,
    url: url.toString(),
    headers,
    ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
    timeoutMs: ctx.budget.attemptMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS,
  })
  const parsed = tryParseJson(text)
  if (!response.ok) {
    throw responseToApiError(response, parsed)
  }
  if (parsed === undefined) {
    throw new CliApiError({
      status: response.status,
      code: 'UNEXPECTED_RESPONSE',
      type: 'internal_error',
      message: 'The API returned a non-JSON success response.',
    })
  }
  return parsed as TResponse
}

function resolveRawIdempotencyKey(
  method: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT',
  provided: string | undefined
): string | undefined {
  if (provided !== undefined && provided !== '') {
    return provided
  }
  return method === 'POST' ? crypto.randomUUID() : undefined
}

export function buildRawHeaders(input: {
  readonly auth: ResolvedAuth
  readonly path: string
  readonly hasJsonBody: boolean
  readonly idempotencyKey?: string | undefined
}): Headers {
  const headers = new Headers({
    authorization: `Bearer ${input.auth.apiKey}`,
    'user-agent': `${CLI_NAME}/${CLI_VERSION}`,
    accept: 'application/json, text/plain;q=0.9',
  })
  if (input.hasJsonBody) {
    headers.set('content-type', 'application/json')
  }
  if (input.auth.brandId !== undefined && !isOrgLevelPath(input.path)) {
    headers.set('x-brand-id', input.auth.brandId)
  }
  if (input.idempotencyKey !== undefined && input.idempotencyKey !== '') {
    headers.set('idempotency-key', input.idempotencyKey)
  }
  return headers
}

export function responseToApiError(
  response: Response,
  parsed: unknown
): CliApiError {
  const requestId = response.headers.get('x-request-id') ?? undefined
  // Standard envelope: { error: {...} }. The trigger-fire endpoints answer
  // with the legacy fire envelope instead — `code`/`message`/`details` at
  // the top level and no `type` — so read those rather than discarding the
  // body, and derive the `type` (and a suggestion) from the HTTP status.
  const record = isRecord(parsed) ? parsed : undefined
  const standard =
    record !== undefined && isRecord(record.error) ? record.error : undefined
  const envelope = standard ?? record
  const readField = (key: string): string | undefined => {
    const value = envelope?.[key]
    return typeof value === 'string' ? value : undefined
  }
  const param = readField('param')
  const suggestion =
    readField('suggestion') ??
    (envelope === undefined ? undefined : suggestionForStatus(response.status))
  const docs = readField('docs')
  const details = isRecord(envelope?.details) ? envelope.details : undefined
  return new CliApiError({
    status: response.status,
    code: readField('code') ?? 'HTTP_ERROR',
    type: readField('type') ?? errorTypeForStatus(response.status),
    message:
      readField('message') ?? `Request failed with status ${response.status}`,
    ...(param === undefined ? {} : { param }),
    ...(suggestion === undefined ? {} : { suggestion }),
    ...(docs === undefined ? {} : { docs }),
    ...(requestId === undefined ? {} : { requestId }),
    ...(details === undefined ? {} : { details }),
    ...(parsed === undefined ? {} : { body: parsed }),
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {}
}
