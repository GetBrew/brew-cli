import { CliUsageError } from './errors'

/**
 * Transport plumbing shared by every command: the whole-command deadline,
 * the `--timeout` / `--max-retries` parsing, and a record of the request in
 * flight so an interrupted or timed-out write can name the idempotency key
 * that replays it.
 */

/**
 * A request's path as the API's routes name it — from `/v1/` on, query
 * included — whatever prefix the base URL adds (`/api`, a tunnel's path).
 */
export function apiPathOf(url: URL): string {
  const index = url.pathname.indexOf('/v1/')
  const path = index === -1 ? url.pathname : url.pathname.slice(index)
  return `${path}${url.search}`
}

/** The one request an envelope can talk about: the latest one sent. */
export type RecordedRequest = {
  readonly method: string
  /** Path and query, never the origin (the API URL can carry a port or tunnel). */
  readonly path: string
  readonly idempotencyKey: string | undefined
}

/** How far an `--all` drain got before it was stopped. */
export type DrainProgress = {
  readonly rowsFetched: number
  readonly pagesFetched: number
  readonly resumeCursor?: string
  /**
   * The flags that resume the drain when they are not `--cursor
   * <resumeCursor> --all`: a comment-thread walk resumes with
   * `--comment-id <id> --messages-cursor <cursor> --all`.
   */
  readonly resumeWith?: string
}

export type TransportState = {
  /** The latest request sent (SDK or raw), for error envelopes. */
  readonly lastRequest: () => RecordedRequest | undefined
  /** How many HTTP attempts this command made. */
  readonly attempts: () => number
  readonly record: (request: RecordedRequest) => void
  readonly drain: () => DrainProgress | undefined
  /** Records how far a drain got; `undefined` clears it (a restarted walk). */
  readonly setDrain: (progress: DrainProgress | undefined) => void
}

export function createTransportState(): TransportState {
  let lastRequest: RecordedRequest | undefined
  let attempts = 0
  let drain: DrainProgress | undefined
  return {
    lastRequest: () => lastRequest,
    attempts: () => attempts,
    record: (request) => {
      lastRequest = request
      attempts += 1
    },
    drain: () => drain,
    setDrain: (progress) => {
      drain = progress
    },
  }
}

/**
 * The SDK's public `fetch` hook, recording each attempt before sending it.
 * `globalThis.fetch` is resolved at CALL time, as the SDK's own default is,
 * so test interceptors installed after the client was built still apply.
 */
export function recordingFetch(state: TransportState): typeof globalThis.fetch {
  return (input, init) => {
    // An already-aborted fetch rejects without sending anything: it is not
    // a request the error envelope should say was in flight.
    if (init?.signal?.aborted === true) {
      return globalThis.fetch(input, init)
    }
    const url = new URL(
      typeof input === 'string' || input instanceof URL ? input : input.url
    )
    state.record({
      method: (init?.method ?? 'GET').toUpperCase(),
      path: apiPathOf(url),
      idempotencyKey:
        new Headers(init?.headers).get('idempotency-key') ?? undefined,
    })
    return globalThis.fetch(input, init)
  }
}

/**
 * `AbortSignal.any`, which landed in Node 20.3; `engines` says `>=20`, so
 * 20.0–20.2 get a listener-based equivalent (and a `release` to detach it).
 */
export function anySignal(signals: ReadonlyArray<AbortSignal | undefined>): {
  readonly signal: AbortSignal
  readonly release: () => void
} {
  const present = signals.filter(
    (signal): signal is AbortSignal => signal !== undefined
  )
  const [only, ...rest] = present
  if (only !== undefined && rest.length === 0) {
    return { signal: only, release: () => undefined }
  }
  if (typeof AbortSignal.any === 'function') {
    return { signal: AbortSignal.any(present), release: () => undefined }
  }
  const controller = new AbortController()
  const alreadyAborted = present.find((signal) => signal.aborted)
  if (alreadyAborted !== undefined) {
    controller.abort(alreadyAborted.reason)
    return { signal: controller.signal, release: () => undefined }
  }
  const listeners = present.map((source) => {
    const onAbort = (): void => {
      controller.abort(source.reason)
    }
    source.addEventListener('abort', onAbort, { once: true })
    return { source, onAbort }
  })
  return {
    signal: controller.signal,
    release: () => {
      for (const { source, onAbort } of listeners) {
        source.removeEventListener('abort', onAbort)
      }
    },
  }
}

const DURATION = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/
const UNIT_MS = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 } as const
const MAX_TIMEOUT_MS = 24 * 3_600_000

/**
 * `--timeout 90`, `90s`, `1500ms`, `5m` or `1h`; a bare number is seconds.
 * Anything else, zero, or over a day is a usage error (exit 2).
 */
export function parseTimeoutFlag(value: unknown): number | undefined {
  if (value === undefined) {
    return
  }
  const match = typeof value === 'string' ? DURATION.exec(value.trim()) : null
  const unit = (match?.[2] ?? 's') as keyof typeof UNIT_MS
  const ms =
    match === null ? Number.NaN : Math.round(Number(match[1]) * UNIT_MS[unit])
  if (!(ms >= 1 && ms <= MAX_TIMEOUT_MS)) {
    throw new CliUsageError(
      `--timeout takes a positive duration up to 24h: 90, 90s, 1500ms or 5m (a bare number is seconds); got "${String(value)}".`
    )
  }
  return ms
}

/** `--max-retries` is a whole number from 0 to 10. */
export function parseMaxRetriesFlag(value: unknown): number | undefined {
  if (value === undefined) {
    return
  }
  const parsed =
    typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN
  if (!(Number.isInteger(parsed) && parsed >= 0 && parsed <= 10)) {
    throw new CliUsageError(
      `--max-retries takes a whole number from 0 to 10; got "${String(value)}".`
    )
  }
  return parsed
}

/**
 * The deadlines one command runs under.
 *
 * - `deadlineMs` bounds the WHOLE command — every attempt, retry, backoff,
 *   `--all` page and response body — from the moment it starts (after any
 *   confirmation prompt).
 * - `attemptMs` is the per-attempt `timeoutMs` handed to the SDK and the
 *   raw transport.
 *
 * An explicit `--timeout` sets both and always wins, longer or shorter than
 * the command's own default. A long-running command's default sets the
 * deadline alone (the SDK already gives the call that long per attempt).
 * Neither: no command deadline, and the SDK's per-attempt default and retry
 * policy apply.
 */
export type Budget = {
  readonly deadlineMs: number | undefined
  readonly attemptMs: number | undefined
}

export function resolveBudget(input: {
  readonly timeoutMs: number | undefined
  readonly defaultTimeoutMs: number | undefined
}): Budget {
  if (input.timeoutMs !== undefined) {
    return { deadlineMs: input.timeoutMs, attemptMs: input.timeoutMs }
  }
  return { deadlineMs: input.defaultTimeoutMs, attemptMs: undefined }
}
