import { PassThrough } from 'node:stream'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { makeContext } from '../../../src/lib/context'
import {
  CliInterruptError,
  CliTimeoutError,
  CliVendorError,
  toErrorEnvelope,
  toExitCode,
} from '../../../src/lib/errors'
import {
  parseRetryAfter,
  vendorFetch,
} from '../../../src/lib/project/vendor-http'
import type { CliContext, CliIo } from '../../../src/lib/types'
import { server } from '../../helpers/msw-server'

const TOKEN = 'sbp_0123456789abcdef0123456789abcdef'
const URL_BASE = 'https://api.supabase.com/v1/projects/abcd/config/auth'

function context(io: Partial<CliIo> = {}, flags = {}): CliContext {
  return makeContext({
    io: {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      isTtyOut: false,
      isTtyIn: false,
      env: {},
      readStdin: async () => '',
      readLine: async () => '',
      ...io,
    },
    flags: { json: true, quiet: true, ...flags },
    rawArgv: [],
  })
}

async function failure(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('expected a rejection')
}

describe('vendorFetch', () => {
  it('sends JSON and returns the parsed body, recording nothing', async () => {
    let seen: { auth: string | null; body: unknown } | undefined
    server.use(
      http.patch(URL_BASE, async ({ request }) => {
        seen = {
          auth: request.headers.get('authorization'),
          body: await request.json(),
        }
        return HttpResponse.json({ ok: true })
      })
    )
    const ctx = context()
    const response = await vendorFetch(ctx, {
      vendor: 'Supabase',
      method: 'PATCH',
      url: URL_BASE,
      headers: { Authorization: `Bearer ${TOKEN}` },
      json: { hook_send_email_enabled: true },
    })
    expect(response.status).toBe(200)
    expect(response.json).toEqual({ ok: true })
    expect(seen).toEqual({
      auth: `Bearer ${TOKEN}`,
      body: { hook_send_email_enabled: true },
    })
    expect(ctx.transport.attempts()).toBe(0)
    expect(ctx.transport.lastRequest()).toBeUndefined()
  })

  it('raises VENDOR_ERROR {vendor, status} without echoing the token', async () => {
    server.use(
      http.get(URL_BASE, () =>
        HttpResponse.json(
          {
            message: `Invalid token ${TOKEN} for project; key sk_live_abcdefghijk`,
          },
          { status: 401 }
        )
      )
    )
    const error = await failure(
      vendorFetch(context(), {
        vendor: 'Supabase',
        method: 'GET',
        url: URL_BASE,
        headers: { Authorization: `Bearer ${TOKEN}` },
      })
    )
    expect(error).toBeInstanceOf(CliVendorError)
    const envelope = toErrorEnvelope(error)
    expect(envelope).toMatchObject({
      code: 'VENDOR_ERROR',
      details: { vendor: 'Supabase', status: 401 },
    })
    expect(JSON.stringify(envelope)).not.toContain(TOKEN)
    expect(JSON.stringify(envelope)).not.toContain('sk_live_abcdefghijk')
    expect(envelope.message).toContain('[redacted]')
    // A vendor 401 is not a Brew auth failure: exit 1, not 3.
    expect(toExitCode(error)).toBe(1)
  })

  it('reads Clerk-style error arrays', async () => {
    server.use(
      http.get('https://api.clerk.com/v1/instance', () =>
        HttpResponse.json(
          {
            errors: [{ message: 'short', long_message: 'Instance not found' }],
          },
          { status: 404 }
        )
      )
    )
    const error = await failure(
      vendorFetch(context(), {
        vendor: 'Clerk',
        method: 'GET',
        url: 'https://api.clerk.com/v1/instance',
      })
    )
    expect((error as Error).message).toBe(
      'Clerk answered 404: Instance not found'
    )
  })

  it('waits out a short retry-after on 429, then succeeds', async () => {
    let calls = 0
    server.use(
      http.get(URL_BASE, () => {
        calls += 1
        return calls === 1
          ? new HttpResponse(null, {
              status: 429,
              headers: { 'retry-after': '0' },
            })
          : HttpResponse.json({ ok: true })
      })
    )
    const response = await vendorFetch(context(), {
      vendor: 'Supabase',
      method: 'GET',
      url: URL_BASE,
    })
    expect(response.status).toBe(200)
    expect(calls).toBe(2)
  })

  it('gives up on a retry-after longer than the bound', async () => {
    let calls = 0
    server.use(
      http.get(URL_BASE, () => {
        calls += 1
        return new HttpResponse(null, {
          status: 429,
          headers: { 'retry-after': '120' },
        })
      })
    )
    const error = await failure(
      vendorFetch(context(), {
        vendor: 'Supabase',
        method: 'GET',
        url: URL_BASE,
        maxRetryAfterMs: 5_000,
      })
    )
    expect(calls).toBe(1)
    expect(error).toMatchObject({ status: 429, retryAfterMs: 120_000 })
    expect(toErrorEnvelope(error).suggestion).toMatch(/rate limiting/)
  })

  it('times out an attempt whose body never ends', async () => {
    server.use(
      http.get(
        URL_BASE,
        () =>
          new HttpResponse(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('{"ok":'))
              },
            }),
            { headers: { 'content-type': 'application/json' } }
          )
      )
    )
    const error = await failure(
      vendorFetch(context(), {
        vendor: 'Supabase',
        method: 'GET',
        url: URL_BASE,
        timeoutMs: 50,
      })
    )
    expect(error).toBeInstanceOf(CliTimeoutError)
  })

  it('stops the moment the command is interrupted', async () => {
    const controller = new AbortController()
    server.use(
      http.get(URL_BASE, async () => {
        controller.abort(new CliInterruptError('SIGINT'))
        await new Promise((resolve) => setTimeout(resolve, 1_000))
        return HttpResponse.json({ ok: true })
      })
    )
    const error = await failure(
      vendorFetch(context({ signal: controller.signal }), {
        vendor: 'Supabase',
        method: 'GET',
        url: URL_BASE,
      })
    )
    expect(error).toBeInstanceOf(CliInterruptError)
  })

  it('reports an unreachable vendor without its query-string token', async () => {
    server.use(
      http.get('https://api.resend.com/emails', () => HttpResponse.error())
    )
    const error = await failure(
      vendorFetch(context(), {
        vendor: 'Resend',
        method: 'GET',
        url: `https://api.resend.com/emails?api_key=${TOKEN}`,
      })
    )
    expect(error).toMatchObject({ vendor: 'Resend', status: null })
    expect((error as Error).message).toMatch(
      /^Could not reach Resend at https:\/\/api\.resend\.com/
    )
    expect((error as Error).message).not.toContain(TOKEN)
  })
})

describe('parseRetryAfter', () => {
  it('reads delta-seconds and HTTP dates', () => {
    expect(parseRetryAfter('3')).toBe(3_000)
    expect(parseRetryAfter('1.5')).toBe(1_500)
    const now = Date.parse('2026-10-11T00:00:00Z')
    expect(parseRetryAfter('Sun, 11 Oct 2026 00:00:10 GMT', now)).toBe(10_000)
    expect(parseRetryAfter('soon')).toBeUndefined()
    expect(parseRetryAfter(null)).toBeUndefined()
  })
})
