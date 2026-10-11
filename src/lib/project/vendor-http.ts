import type { HttpMethod } from '../define-command'
import { CliTimeoutError, CliVendorError } from '../errors'
import { DEFAULT_ATTEMPT_TIMEOUT_MS, readBodyText } from '../raw-request'
import { anySignal } from '../transport'
import type { CliContext } from '../types'

/**
 * HTTP to third-party APIs a project command drives on the user's behalf
 * (Supabase Management API, Clerk, Resend during a migration), with the
 * same discipline as `rawFetch`: a per-attempt deadline that covers the
 * body, the command's signal (Ctrl-C, `--timeout`) observed throughout.
 *
 * Two differences from Brew calls, both deliberate:
 * - it never records into `ctx.transport`: error envelopes and their
 *   replay advice describe Brew requests only, and a vendor URL can carry
 *   a project ref or token that must not land in a transcript;
 * - a failure is a `CliVendorError` (`VENDOR_ERROR`, exit 1) naming the
 *   vendor and status. Its message quotes the vendor's own error text with
 *   every credential the request carried — and anything shaped like a key —
 *   redacted.
 *
 * A 429 waits out `retry-after` when it is short (bounded by
 * `maxRetryAfterMs`), then retries; a longer wait is the caller's call.
 */

export type VendorRequest = {
  /** Display name, e.g. `Supabase`. */
  readonly vendor: string
  readonly method: HttpMethod
  readonly url: string
  readonly headers?: Readonly<Record<string, string>>
  /** A JSON body (serialized here) or a raw string. */
  readonly json?: unknown
  readonly body?: string
  /** One attempt's deadline. Default: `--timeout`, else 30 s. */
  readonly timeoutMs?: number
  /** The longest `retry-after` worth waiting for in-process. Default 10 s. */
  readonly maxRetryAfterMs?: number
  /** Attempts in total, 429 retries included. Default 3. */
  readonly maxAttempts?: number
}

export type VendorResponse = {
  readonly status: number
  readonly headers: Headers
  readonly text: string
  /** The body parsed as JSON, or `undefined` when it is not JSON. */
  readonly json: unknown
}

const DEFAULT_MAX_RETRY_AFTER_MS = 10_000
const DEFAULT_429_BACKOFF_MS = 1_000
const MAX_DETAIL_LENGTH = 300
const CREDENTIAL_HEADER =
  /authorization|cookie|api-?key|apikey|auth|token|secret|passw(or)?d|session|signature/i
const KEY_SHAPED =
  /\b(?:sk|pk|rk|re|sbp|sb|brew|whsec|ghp|gho|xox[abp])_[A-Za-z0-9_-]{8,}\b|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g

type VendorContext = Pick<CliContext, 'signal' | 'budget'>

export async function vendorFetch(
  ctx: VendorContext,
  request: VendorRequest
): Promise<VendorResponse> {
  const maxAttempts = Math.max(1, request.maxAttempts ?? 3)
  const maxRetryAfterMs = request.maxRetryAfterMs ?? DEFAULT_MAX_RETRY_AFTER_MS
  const secrets = collectSecrets(request)
  for (let attempt = 1; ; attempt += 1) {
    const response = await attemptOnce(ctx, request, secrets)
    if (response.status >= 200 && response.status < 300) {
      return response
    }
    if (response.status === 429) {
      const wait =
        parseRetryAfter(response.headers.get('retry-after')) ??
        DEFAULT_429_BACKOFF_MS * attempt
      if (attempt < maxAttempts && wait <= maxRetryAfterMs) {
        await sleep(wait, ctx.signal)
        continue
      }
      throw new CliVendorError({
        vendor: request.vendor,
        status: 429,
        message: vendorMessage(request.vendor, response, secrets),
        retryAfterMs: wait,
      })
    }
    throw new CliVendorError({
      vendor: request.vendor,
      status: response.status,
      message: vendorMessage(request.vendor, response, secrets),
    })
  }
}

async function attemptOnce(
  ctx: VendorContext,
  request: VendorRequest,
  secrets: readonly string[]
): Promise<VendorResponse> {
  const timeoutMs =
    request.timeoutMs ?? ctx.budget.attemptMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS
  const deadline = new AbortController()
  const timer = setTimeout(() => {
    deadline.abort(new CliTimeoutError(timeoutMs))
  }, timeoutMs)
  const combined = anySignal([ctx.signal, deadline.signal])
  const { signal } = combined
  try {
    signal.throwIfAborted()
    const headers = new Headers(request.headers)
    let body = request.body
    if (request.json !== undefined) {
      body = JSON.stringify(request.json)
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json')
      }
    }
    if (!headers.has('accept')) {
      headers.set('accept', 'application/json')
    }
    let response: Response
    let text: string
    try {
      response = await fetch(request.url, {
        method: request.method,
        headers,
        signal,
        ...(body === undefined ? {} : { body }),
      })
      text = await readBodyText(response, signal)
    } catch (error) {
      if (signal.aborted) {
        throw signal.reason
      }
      const cause = error instanceof Error ? error.cause : undefined
      const code =
        typeof cause === 'object' && cause !== null && 'code' in cause
          ? ` (${String((cause as { code: unknown }).code)})`
          : ''
      throw new CliVendorError({
        vendor: request.vendor,
        status: null,
        message: redact(
          `Could not reach ${request.vendor} at ${safeOrigin(request.url)}${code}.`,
          secrets
        ),
      })
    }
    return {
      status: response.status,
      headers: response.headers,
      text,
      json: tryParseJson(text),
    }
  } finally {
    clearTimeout(timer)
    combined.release()
  }
}

/** Every credential the request carries, so error text can never echo one. */
function collectSecrets(request: VendorRequest): string[] {
  const secrets: string[] = []
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    if (!CREDENTIAL_HEADER.test(name) || value === '') {
      continue
    }
    secrets.push(value)
    const scheme = /^\s*(?:bearer|basic|token)\s+(.+)$/i.exec(value)
    if (scheme?.[1] !== undefined) {
      secrets.push(scheme[1].trim())
    }
  }
  try {
    for (const [, value] of new URL(request.url).searchParams) {
      if (value.length >= 8) {
        secrets.push(value)
      }
    }
  } catch {}
  // Longest first, so a token is redacted whole before any substring.
  return [...new Set(secrets)]
    .filter((secret) => secret.length >= 4)
    .sort((a, b) => b.length - a.length)
}

export function redact(text: string, secrets: readonly string[]): string {
  let out = text
  for (const secret of secrets) {
    out = out.split(secret).join('[redacted]')
  }
  return out.replace(KEY_SHAPED, '[redacted]')
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return 'an invalid URL'
  }
}

function vendorMessage(
  vendor: string,
  response: VendorResponse,
  secrets: readonly string[]
): string {
  const detail = vendorDetail(response.json)
  const text =
    detail === undefined
      ? `${vendor} answered ${response.status}.`
      : `${vendor} answered ${response.status}: ${detail.slice(0, MAX_DETAIL_LENGTH)}`
  return redact(text, secrets)
}

/** The human part of common vendor error bodies. */
function vendorDetail(json: unknown): string | undefined {
  if (typeof json !== 'object' || json === null) {
    return undefined
  }
  const record = json as Record<string, unknown>
  for (const key of ['message', 'error_description', 'msg', 'error']) {
    const value = record[key]
    if (typeof value === 'string' && value !== '') {
      return value
    }
    if (typeof value === 'object' && value !== null) {
      const nested = (value as Record<string, unknown>).message
      if (typeof nested === 'string' && nested !== '') {
        return nested
      }
    }
  }
  const errors = record.errors
  if (Array.isArray(errors)) {
    const first = errors[0] as Record<string, unknown> | undefined
    const message = first?.long_message ?? first?.message
    if (typeof message === 'string' && message !== '') {
      return message
    }
  }
  return undefined
}

/** `retry-after` as milliseconds: delta-seconds or an HTTP date. */
export function parseRetryAfter(
  value: string | null,
  now: number = Date.now()
): number | undefined {
  if (value === null || value.trim() === '') {
    return undefined
  }
  const trimmed = value.trim()
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.ceil(Number(trimmed) * 1000)
  }
  const date = Date.parse(trimmed)
  return Number.isNaN(date) ? undefined : Math.max(0, date - now)
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}
