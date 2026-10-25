import type { webcrypto } from 'node:crypto'
import { systemClock } from '../clock'
import { CliApiError, CliAuthError } from '../errors'
import type { CliContext } from '../types'
import { type LoginKeyKind, parseSealedPayload, unseal } from './seal'
import { pollToken, type TokenSuccess } from './session'

/**
 * An approval extends the session to at least a minute after it, so the
 * CLI keeps polling until a minute past `expiresAt` (runbook: a person who
 * approves in the last seconds must not see "signed in" while expiry
 * revokes the keys).
 */
export const EXPIRY_GRACE_MS = 60_000
/** RFC 8628: each `slow_down` adds five seconds to the interval. */
export const SLOW_DOWN_STEP_MS = 5000
const MIN_INTERVAL_MS = 1000
const MAX_INTERVAL_MS = 60_000
/** Transient failures in a row before the sign-in gives up on them. */
const MAX_CONSECUTIVE_RETRIES = 10

/** Error codes that end a sign-in for good: start a new one. */
export const FINAL_LOGIN_CODES: ReadonlySet<string> = new Set([
  'CLI_LOGIN_DENIED',
  'CLI_LOGIN_EXPIRED',
  'CLI_LOGIN_INVALID_GRANT',
])

/** A sign-in being polled, with its secrets in memory. */
export type ActiveLogin = {
  readonly sessionId: string
  readonly pollSecret: string
  readonly privateKey: webcrypto.CryptoKey
  readonly expiresAt: string
  /** Seconds, from the server. */
  readonly interval: number
  readonly siteUrl: string
}

/** What an approval handed over. The keys stay in memory. */
export type ApprovedLogin = {
  readonly keys: Partial<
    Record<LoginKeyKind, { readonly key: string; readonly keyId: string }>
  >
  readonly brand: TokenSuccess['brand']
  readonly approver: TokenSuccess['approver']
  readonly orgId: string
  readonly apiBaseUrl: string
}

export type WaitOutcome =
  | { readonly status: 'approved'; readonly approved: ApprovedLogin }
  /** `waitMs` ran out first; the session can still be resumed. */
  | { readonly status: 'pending' }

/**
 * Polls until the person approves or denies, the session expires, or
 * `waitMs` runs out. `pollFirst` polls before the first wait (a resumed
 * sign-in may already be approved); a fresh one waits an interval first.
 */
export async function waitForApproval(
  ctx: CliContext,
  login: ActiveLogin,
  options: {
    /** Undefined: until the session expires. `0`: one poll at most. */
    readonly waitMs: number | undefined
    readonly pollFirst: boolean
    /** The command that starts over, for error suggestions. */
    readonly restartCommand: string
  }
): Promise<WaitOutcome> {
  const clock = ctx.io.clock ?? systemClock
  const sessionDeadline = Date.parse(login.expiresAt) + EXPIRY_GRACE_MS
  const waitDeadline =
    options.waitMs === undefined
      ? Number.POSITIVE_INFINITY
      : clock.now() + options.waitMs
  let intervalMs = clamp(login.interval * 1000)
  let delayMs = options.pollFirst ? 0 : intervalMs
  let retries = 0
  for (;;) {
    const now = clock.now()
    if (now >= sessionDeadline) {
      throw expiredError(options.restartCommand, false)
    }
    if (delayMs > 0) {
      const remainingWait = waitDeadline - now
      // Too little left for another poll the server would accept.
      if (remainingWait < MIN_INTERVAL_MS) {
        return { status: 'pending' }
      }
      await clock.sleep(
        Math.min(delayMs, remainingWait, sessionDeadline - now),
        ctx.signal
      )
    }
    const result = await pollToken(
      ctx,
      {
        siteUrl: login.siteUrl,
        sessionId: login.sessionId,
        pollSecret: login.pollSecret,
      },
      clock.now()
    )
    switch (result.kind) {
      case 'approved':
        return {
          status: 'approved',
          approved: await openSeal(login, result.token, options),
        }
      case 'pending':
        retries = 0
        delayMs = intervalMs
        break
      case 'slow_down':
        retries = 0
        intervalMs = clamp(intervalMs + SLOW_DOWN_STEP_MS)
        delayMs = intervalMs
        break
      case 'retry':
        retries += 1
        if (retries > MAX_CONSECUTIVE_RETRIES) {
          throw result.error
        }
        delayMs = Math.max(intervalMs, result.retryAfterMs ?? 0)
        break
      case 'denied':
        throw new CliAuthError(
          'The sign-in was denied in the browser.',
          `Run \`${options.restartCommand}\` to start a new one.`,
          'CLI_LOGIN_DENIED'
        )
      case 'expired':
        throw expiredError(options.restartCommand, true)
      case 'invalid_grant':
        throw new CliAuthError(
          'Brew no longer has this sign-in: it expired and was cleaned up, or the poll secret did not match.',
          `Run \`${options.restartCommand}\` to start a new one.`,
          'CLI_LOGIN_INVALID_GRANT'
        )
    }
  }
}

function expiredError(
  restartCommand: string,
  fromServer: boolean
): CliAuthError {
  return new CliAuthError(
    fromServer
      ? 'The sign-in expired, or its keys were already collected.'
      : 'The sign-in expired before it was approved.',
    fromServer
      ? `Run \`${restartCommand}\` to start a new one. Keys whose response never arrived stay listed as "CLI · …" under Settings, API keys, where they can be revoked.`
      : `Run \`${restartCommand}\` to start a new one.`,
    'CLI_LOGIN_EXPIRED'
  )
}

async function openSeal(
  login: ActiveLogin,
  token: TokenSuccess,
  options: { readonly restartCommand: string }
): Promise<ApprovedLogin> {
  let plaintext: string
  try {
    plaintext = await unseal({
      privateKey: login.privateKey,
      sessionId: login.sessionId,
      sealed: token.sealed,
    })
  } catch {
    throw sealError(options.restartCommand)
  }
  const payload = parseSealedPayload(plaintext)
  if (payload === undefined) {
    throw sealError(options.restartCommand)
  }
  const keys: Partial<Record<LoginKeyKind, { key: string; keyId: string }>> = {}
  for (const entry of payload.keys) {
    keys[entry.kind] = { key: entry.key, keyId: entry.keyId }
  }
  return {
    keys,
    brand: token.brand,
    approver: token.approver,
    orgId: token.orgId,
    apiBaseUrl: token.apiBaseUrl,
  }
}

function sealError(restartCommand: string): CliApiError {
  return new CliApiError({
    status: 200,
    code: 'CLI_LOGIN_SEAL_INVALID',
    type: 'internal_error',
    message:
      'The keys Brew sent could not be opened with this sign-in’s private key.',
    suggestion: `Revoke the "CLI · …" key created just now under Settings, API keys, then run \`${restartCommand}\` again.`,
  })
}

function clamp(intervalMs: number): number {
  if (!Number.isFinite(intervalMs)) {
    return MIN_INTERVAL_MS
  }
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, intervalMs))
}
