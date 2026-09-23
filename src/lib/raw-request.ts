import { CLI_NAME, CLI_VERSION } from '../version'
import type { ResolvedAuth } from './client'
import { isOrgLevelPath, resolveAuth } from './client'
import { CliApiError, errorTypeForStatus, suggestionForStatus } from './errors'
import type { CliContext } from './types'

/**
 * Minimal typed transport for public-API operations the published SDK does
 * not expose yet. Shares auth resolution, the X-Brand-Id policy, and
 * error-envelope mapping with the `api` escape hatch. Each caller swaps to
 * the SDK method when it ships — the parity-sdk sentinel flags the moment
 * that becomes possible. Unlike the SDK transport, raw calls are
 * single-attempt (no retry loop). POST calls receive an invocation-scoped
 * idempotency key automatically; callers can provide a stable key when they
 * need to replay safely across process restarts.
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
    readonly signal?: AbortSignal
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
  const response = await fetch(url, {
    method: request.method,
    headers,
    ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
    ...(request.signal === undefined ? {} : { signal: request.signal }),
  })
  const text = await response.text()
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
