import { hostname as osHostname } from 'node:os'
import { CLI_NAME, CLI_VERSION } from '../../version'
import { LOGIN_KEYS_URL } from '../client'
import {
  CliApiError,
  CliAuthError,
  CliConnectionError,
  CliUsageError,
  errorTypeForStatus,
  isTimeoutError,
  suggestionForStatus,
} from '../errors'
import { getInvocationPrefix } from '../invocation'
import {
  DEFAULT_ATTEMPT_TIMEOUT_MS,
  rawFetch,
  tryParseJson,
} from '../raw-request'
import type { CliContext } from '../types'
import type { LoginKeyKind, PublicKeyJwk, SealedKeys } from './seal'

/**
 * The two browser sign-in routes (brew-v2 `docs/runbooks/cli-login.md`).
 * They live off `/v1` on the site origin, take no credential, and answer
 * OAuth-device-flow style `{ error }` bodies instead of API envelopes.
 */

/** Display-only facts the approval page shows under "Reported by the CLI". */
export type LoginClientInfo = {
  readonly hostname?: string
  readonly os?: string
  readonly cliVersion?: string
  readonly project?: string
  readonly appUrl?: string
}

/** `201` of `POST /api/cli/sessions`. */
export type CreatedSession = {
  readonly sessionId: string
  /** `XXXX-XXXX`, shown in the terminal and on the approval page. */
  readonly userCode: string
  readonly verificationUrl: string
  /** ISO 8601. */
  readonly expiresAt: string
  /** Seconds between polls. */
  readonly interval: number
}

/** `200` of `POST /api/cli/sessions/{sessionId}/token`, returned once. */
export type TokenSuccess = {
  readonly sealed: SealedKeys
  readonly keys: ReadonlyArray<{
    readonly kind: LoginKeyKind
    readonly keyId: string
  }>
  readonly orgId: string
  readonly brand: { readonly brandId: string; readonly name: string }
  readonly approver: { readonly email: string }
  readonly apiBaseUrl: string
}

export type PollResult =
  | { readonly kind: 'approved'; readonly token: TokenSuccess }
  | { readonly kind: 'pending' }
  | { readonly kind: 'slow_down' }
  /** Transient (429, 5xx, a dropped or timed-out attempt): poll again. */
  | {
      readonly kind: 'retry'
      readonly retryAfterMs: number | undefined
      readonly error: Error
    }
  | { readonly kind: 'denied' }
  /** 410: expired, or its keys were already collected. */
  | { readonly kind: 'expired' }
  /** Unknown session or wrong poll secret, or deleted after expiry. */
  | { readonly kind: 'invalid_grant' }

const MAX_RETRY_AFTER_MS = 60_000

/**
 * The site the sign-in routes live on: the API URL without its `/api`
 * suffix (`https://brew.new/api` → `https://brew.new`).
 */
export function siteUrlFromApiUrl(apiUrl: string): string {
  const site = apiUrl.replace(/\/+$/, '').replace(/\/api$/, '')
  let parsed: URL
  try {
    parsed = new URL(site)
  } catch {
    throw new CliUsageError(
      `The API URL must be an absolute http(s) URL; got "${apiUrl}".`
    )
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new CliUsageError(
      `The API URL must be an absolute http(s) URL; got "${apiUrl}".`
    )
  }
  return site
}

/** What this machine reports about itself; every member optional. */
export function defaultClientInfo(): LoginClientInfo {
  const hostname = displayValue(safeHostname(), 253)
  return {
    ...(hostname === undefined ? {} : { hostname }),
    os: process.platform,
    cliVersion: CLI_VERSION.slice(0, 32),
  }
}

/** Drops empty and over-long values the route would refuse. */
export function cleanClientInfo(info: LoginClientInfo): LoginClientInfo {
  const limits: Record<keyof LoginClientInfo, number> = {
    hostname: 253,
    os: 64,
    cliVersion: 32,
    project: 100,
    appUrl: 512,
  }
  const cleaned: Record<string, string> = {}
  for (const [key, limit] of Object.entries(limits)) {
    const value = displayValue(info[key as keyof LoginClientInfo], limit)
    if (value !== undefined) {
      cleaned[key] = value
    }
  }
  return cleaned
}

export async function createSession(
  ctx: CliContext,
  input: {
    readonly siteUrl: string
    readonly publicKey: PublicKeyJwk
    readonly pollSecretHash: string
    readonly keys: readonly LoginKeyKind[]
    readonly client: LoginClientInfo
  }
): Promise<CreatedSession> {
  const { response, text } = await rawFetch(ctx, {
    method: 'POST',
    url: `${input.siteUrl}/api/cli/sessions`,
    headers: jsonHeaders(),
    body: JSON.stringify({
      publicKey: input.publicKey,
      pollSecretHash: input.pollSecretHash,
      keys: input.keys,
      client: input.client,
    }),
    timeoutMs: attemptTimeoutMs(ctx),
  })
  const parsed = tryParseJson(text)
  if (response.status === 201) {
    const session = readCreatedSession(parsed)
    if (session === undefined) {
      throw unexpectedResponse(201, 'POST /api/cli/sessions')
    }
    return session
  }
  const code = errorCodeOf(parsed)
  // A server without the routes answers 404 (or its sign-in gate a 401,
  // 403 or an HTML page): browser sign-in is not deployed there.
  if (
    [401, 403, 404, 405].includes(response.status) ||
    (code === undefined && response.status < 500)
  ) {
    const prefix = getInvocationPrefix(ctx.io.env)
    throw new CliAuthError(
      `${input.siteUrl} does not offer browser sign-in (POST /api/cli/sessions answered ${response.status}).`,
      `Run \`${prefix} login --paste\` with a key from ${LOGIN_KEYS_URL}, or set BREW_API_KEY.`,
      'CLI_LOGIN_UNAVAILABLE'
    )
  }
  const retryAfterMs = retryAfterOf(response, Date.now())
  throw new CliApiError({
    status: response.status,
    code: (code ?? 'server_error').toUpperCase(),
    type: errorTypeForStatus(response.status),
    message:
      messageOf(parsed) ??
      `Brew could not start a sign-in (${response.status}).`,
    suggestion:
      retryAfterMs === undefined
        ? suggestionForStatus(response.status)
        : `Run the command again in ${Math.ceil(retryAfterMs / 1000)} s.`,
    body: parsed,
  })
}

/**
 * One token poll, classified. Throws only for a stop (interrupt, the
 * command's deadline), a malformed request, or an answer outside the
 * contract.
 */
export async function pollToken(
  ctx: CliContext,
  input: {
    readonly siteUrl: string
    readonly sessionId: string
    readonly pollSecret: string
  },
  now: number
): Promise<PollResult> {
  let response: Response
  let text: string
  try {
    ;({ response, text } = await rawFetch(ctx, {
      method: 'POST',
      url: `${input.siteUrl}/api/cli/sessions/${encodeURIComponent(input.sessionId)}/token`,
      headers: jsonHeaders(),
      body: JSON.stringify({ pollSecret: input.pollSecret }),
      timeoutMs: attemptTimeoutMs(ctx),
    }))
  } catch (error) {
    // Ctrl-C, SIGTERM and --timeout end the sign-in; one dropped or slow
    // attempt does not.
    if (ctx.signal.aborted) {
      throw error
    }
    if (
      error instanceof Error &&
      (error instanceof CliConnectionError || isTimeoutError(error))
    ) {
      return { kind: 'retry', retryAfterMs: undefined, error }
    }
    throw error
  }
  const parsed = tryParseJson(text)
  if (response.status === 200) {
    const token = readTokenSuccess(parsed)
    if (token === undefined) {
      throw unexpectedResponse(200, 'POST /api/cli/sessions/{id}/token')
    }
    return { kind: 'approved', token }
  }
  const code = errorCodeOf(parsed)
  switch (code) {
    case 'authorization_pending':
      return { kind: 'pending' }
    case 'slow_down':
      return { kind: 'slow_down' }
    case 'access_denied':
      return { kind: 'denied' }
    case 'expired_token':
      return { kind: 'expired' }
    case 'invalid_grant':
      return { kind: 'invalid_grant' }
    default:
      break
  }
  const error = new CliApiError({
    status: response.status,
    code: (code ?? 'server_error').toUpperCase(),
    type: errorTypeForStatus(response.status),
    message:
      messageOf(parsed) ??
      `Brew could not answer the sign-in poll (${response.status}).`,
    suggestion: suggestionForStatus(response.status),
    body: parsed,
  })
  if (response.status === 429 || response.status >= 500) {
    return { kind: 'retry', retryAfterMs: retryAfterOf(response, now), error }
  }
  throw error
}

/**
 * Text from the server (brand names, emails, codes) with control and
 * invisible characters removed, so it cannot rewrite the terminal.
 */
export function printable(text: string): string {
  return text.replace(/\p{C}/gu, '')
}

function displayValue(
  value: string | undefined,
  limit: number
): string | undefined {
  if (value === undefined) {
    return
  }
  const cleaned = printable(value).trim().slice(0, limit).trim()
  return cleaned === '' ? undefined : cleaned
}

function safeHostname(): string | undefined {
  try {
    return osHostname()
  } catch {
    return
  }
}

function jsonHeaders(): Headers {
  return new Headers({
    accept: 'application/json',
    'content-type': 'application/json',
    'user-agent': `${CLI_NAME}/${CLI_VERSION}`,
  })
}

function attemptTimeoutMs(ctx: CliContext): number {
  return ctx.budget.attemptMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS
}

function unexpectedResponse(status: number, route: string): CliApiError {
  return new CliApiError({
    status,
    code: 'UNEXPECTED_RESPONSE',
    type: 'internal_error',
    message: `${route} answered ${status} with a body outside the sign-in contract.`,
    suggestion: 'Update the CLI, then sign in again.',
  })
}

function readCreatedSession(value: unknown): CreatedSession | undefined {
  if (!isRecord(value)) {
    return
  }
  const { sessionId, userCode, verificationUrl, expiresAt, interval } = value
  if (
    typeof sessionId !== 'string' ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(sessionId) ||
    typeof userCode !== 'string' ||
    typeof verificationUrl !== 'string' ||
    !isHttpUrl(verificationUrl) ||
    typeof expiresAt !== 'string' ||
    Number.isNaN(Date.parse(expiresAt)) ||
    typeof interval !== 'number' ||
    !Number.isFinite(interval)
  ) {
    return
  }
  return { sessionId, userCode, verificationUrl, expiresAt, interval }
}

function readTokenSuccess(value: unknown): TokenSuccess | undefined {
  if (!isRecord(value)) {
    return
  }
  const { sealed, keys, orgId, brand, approver, apiBaseUrl } = value
  if (
    !isRecord(sealed) ||
    typeof sealed.serverPublicKey !== 'string' ||
    typeof sealed.iv !== 'string' ||
    typeof sealed.ciphertext !== 'string' ||
    !isRecord(brand) ||
    typeof brand.brandId !== 'string' ||
    typeof brand.name !== 'string' ||
    !isRecord(approver) ||
    typeof approver.email !== 'string' ||
    !Array.isArray(keys)
  ) {
    return
  }
  const keyRows: Array<TokenSuccess['keys'][number]> = []
  for (const row of keys) {
    if (
      isRecord(row) &&
      (row.kind === 'cli' || row.kind === 'app') &&
      typeof row.keyId === 'string'
    ) {
      keyRows.push({ kind: row.kind, keyId: row.keyId })
    }
  }
  return {
    sealed: {
      serverPublicKey: sealed.serverPublicKey,
      iv: sealed.iv,
      ciphertext: sealed.ciphertext,
    },
    keys: keyRows,
    orgId: typeof orgId === 'string' ? orgId : '',
    brand: { brandId: brand.brandId, name: brand.name },
    approver: { email: approver.email },
    apiBaseUrl: typeof apiBaseUrl === 'string' ? apiBaseUrl : '',
  }
}

function errorCodeOf(value: unknown): string | undefined {
  return isRecord(value) && typeof value.error === 'string'
    ? value.error
    : undefined
}

function messageOf(value: unknown): string | undefined {
  return isRecord(value) &&
    typeof value.message === 'string' &&
    value.message !== ''
    ? printable(value.message)
    : undefined
}

/** `Retry-After` in seconds or as an HTTP date, capped at a minute. */
function retryAfterOf(response: Response, now: number): number | undefined {
  const header = response.headers.get('retry-after')?.trim()
  if (header === undefined || header === '') {
    return
  }
  const seconds = Number(header)
  const ms = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(header) - now
  if (!Number.isFinite(ms) || ms < 0) {
    return
  }
  return Math.min(ms, MAX_RETRY_AFTER_MS)
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
