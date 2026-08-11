import { CLI_NAME, CLI_VERSION } from '../version'
import type { ResolvedAuth } from './client'
import { isOrgLevelPath, resolveAuth } from './client'
import { CliApiError } from './errors'
import type { CliContext } from './types'

/**
 * Minimal typed transport for public-API operations the published SDK does
 * not expose yet. Shares auth resolution, the X-Brand-Id policy, and
 * error-envelope mapping with the `api` escape hatch. Each caller swaps to
 * the SDK method when it ships — the parity-sdk sentinel flags the moment
 * that becomes possible. Unlike the SDK transport, raw calls are
 * single-attempt (no retry loop), so POST callers should pass an
 * idempotency key when re-running matters.
 */
export async function rawRequest<TResponse>(
  ctx: CliContext,
  request: {
    readonly method: 'DELETE' | 'GET' | 'PATCH' | 'POST'
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
  const headers = buildRawHeaders({
    auth,
    path: request.path,
    hasJsonBody: hasBody,
    idempotencyKey: request.idempotencyKey,
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
  // Standard envelope: { error: {...} }. A few legacy endpoints (e.g.
  // trigger fire) put code/message at the top level instead — fall back
  // to those rather than discarding the body.
  const record =
    parsed !== null && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : undefined
  const envelope =
    record !== undefined &&
    record.error !== null &&
    typeof record.error === 'object'
      ? (record.error as Record<string, unknown>)
      : record
  const readField = (key: string): string | undefined => {
    const value = envelope?.[key]
    return typeof value === 'string' ? value : undefined
  }
  const param = readField('param')
  const suggestion = readField('suggestion')
  const docs = readField('docs')
  return new CliApiError({
    status: response.status,
    code: readField('code') ?? 'HTTP_ERROR',
    type: readField('type') ?? 'internal_error',
    message:
      readField('message') ?? `Request failed with status ${response.status}`,
    ...(param === undefined ? {} : { param }),
    ...(suggestion === undefined ? {} : { suggestion }),
    ...(docs === undefined ? {} : { docs }),
    ...(requestId === undefined ? {} : { requestId }),
  })
}

export function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {}
}
