import { CliUsageError } from './errors'
import { imageUploadRequestContext } from './image-upload-recovery'

export function apiPathOf(url: URL): string {
  const index = url.pathname.indexOf('/v1/')
  const path = index === -1 ? url.pathname : url.pathname.slice(index)
  return `${path}${url.search}`
}

export type RecordedRequest = {
  readonly method: string
  readonly path: string
  readonly idempotencyKey: string | undefined
  readonly uploadId?: string
  readonly brandId?: string
}

export type DrainProgress = {
  readonly rowsFetched: number
  readonly pagesFetched: number
  readonly resumeCursor?: string
  readonly resumeWith?: string
}

export type TransportState = {
  readonly lastRequest: () => RecordedRequest | undefined
  readonly attempts: () => number
  readonly record: (request: RecordedRequest) => void
  readonly drain: () => DrainProgress | undefined
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

export function recordingFetch(state: TransportState): typeof globalThis.fetch {
  return (input, init) => {
    if (init?.signal?.aborted === true) {
      return globalThis.fetch(input, init)
    }
    const url = new URL(
      typeof input === 'string' || input instanceof URL ? input : input.url
    )
    const method = (init?.method ?? 'GET').toUpperCase()
    const path = apiPathOf(url)
    const headers = new Headers(init?.headers)
    state.record({
      method,
      path,
      idempotencyKey: headers.get('idempotency-key') ?? undefined,
      ...imageUploadRequestContext({ method, path, headers, body: init?.body }),
    })
    return globalThis.fetch(input, init)
  }
}

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
