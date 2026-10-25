import { CLI_VERSION } from '../../../version'
import { type Clock, systemClock } from '../../clock'
import { CliVendorError } from '../../errors'
import { vendorFetch } from '../../project/vendor-http'
import type { CliContext } from '../../types'

/**
 * Read-only access to the Resend API for a migration. The key stays on this
 * machine: it rides only requests to `api.resend.com`, which go through
 * `vendorFetch` (never recorded into the Brew transport, credentials
 * redacted from every error) and never appears in output or the manifest.
 *
 * Requests are paced to `requestsPerSecond` (Resend's default team limit
 * is shared with the app still sending through it, so the migration takes
 * a small slice), and a 429 waits out its `retry-after` before retrying.
 */

export const RESEND_API_URL = 'https://api.resend.com'
export const RESEND_VENDOR = 'Resend'

const MAX_429_RETRIES = 5
const MAX_RETRY_AFTER_MS = 60_000
const DEFAULT_429_WAIT_MS = 1_000

/** The key may only send email: listing anything needs a full-access key. */
export class ResendAccessError extends Error {
  readonly status: number
  readonly reason: 'sending_only' | 'rejected'

  constructor(input: {
    readonly status: number
    readonly reason: 'sending_only' | 'rejected'
    readonly message: string
  }) {
    super(input.message)
    this.name = 'ResendAccessError'
    this.status = input.status
    this.reason = input.reason
  }
}

export type ResendList<T> = {
  readonly data: readonly T[]
  readonly hasMore: boolean
}

export type ResendClient = {
  /** One GET, paced and retried on 429; `undefined` for a 404. */
  readonly get: (
    path: string,
    query?: Readonly<Record<string, string | undefined>>
  ) => Promise<unknown>
  /** One page of a list endpoint (`limit` ≤ 100, `after` cursor). */
  readonly page: <T>(
    path: string,
    options?: { readonly after?: string; readonly limit?: number }
  ) => Promise<ResendList<T>>
  /** Requests made so far. */
  readonly requestCount: () => number
}

type ClientContext = Pick<CliContext, 'signal' | 'budget' | 'io'>

export function createResendClient(
  ctx: ClientContext,
  input: {
    readonly apiKey: string
    readonly requestsPerSecond: number
    readonly clock?: Clock
  }
): ResendClient {
  const clock = input.clock ?? ctx.io.clock ?? systemClock
  const interval = Math.ceil(1000 / Math.max(0.1, input.requestsPerSecond))
  let lastStart: number | undefined
  let count = 0

  const pace = async (): Promise<void> => {
    if (lastStart !== undefined) {
      const wait = lastStart + interval - clock.now()
      if (wait > 0) {
        await clock.sleep(wait, ctx.signal)
      }
    }
    lastStart = clock.now()
  }

  const get = async (
    path: string,
    query: Readonly<Record<string, string | undefined>> = {}
  ): Promise<unknown> => {
    const url = new URL(path, RESEND_API_URL)
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(name, value)
      }
    }
    for (let attempt = 1; ; attempt += 1) {
      await pace()
      count += 1
      try {
        const response = await vendorFetch(ctx, {
          vendor: RESEND_VENDOR,
          method: 'GET',
          url: url.toString(),
          headers: {
            authorization: `Bearer ${input.apiKey}`,
            'user-agent': `brew-cli/${CLI_VERSION} (migrate resend)`,
          },
          maxAttempts: 1,
        })
        return response.json
      } catch (error) {
        ctx.signal.throwIfAborted()
        if (!(error instanceof CliVendorError)) {
          throw error
        }
        if (error.status === 404) {
          return undefined
        }
        if (error.status === 401 || error.status === 403) {
          const sendingOnly = /restricted|only send|sending/i.test(
            error.message
          )
          throw new ResendAccessError({
            status: error.status,
            reason: sendingOnly ? 'sending_only' : 'rejected',
            message: sendingOnly
              ? 'This Resend API key can only send emails. Reading templates, contacts and domains needs a full-access key.'
              : `Resend rejected the API key (${error.status}). Check it is active and has full access.`,
          })
        }
        if (error.status === 429 && attempt <= MAX_429_RETRIES) {
          const wait = Math.min(
            error.retryAfterMs ?? DEFAULT_429_WAIT_MS * attempt,
            MAX_RETRY_AFTER_MS
          )
          await clock.sleep(wait, ctx.signal)
          continue
        }
        throw error
      }
    }
  }

  const page = async <T>(
    path: string,
    options: { readonly after?: string; readonly limit?: number } = {}
  ): Promise<ResendList<T>> => {
    const json = (await get(path, {
      limit: String(options.limit ?? 100),
      after: options.after,
    })) as { data?: unknown; has_more?: unknown } | undefined
    const data = Array.isArray(json?.data) ? (json.data as T[]) : []
    return { data, hasMore: json?.has_more === true && data.length > 0 }
  }

  return { get, page, requestCount: () => count }
}
