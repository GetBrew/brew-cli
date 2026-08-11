import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'

function env(
  extra: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    BREW_API_KEY: KEY,
    ...extra,
  }
}

describe('api escape hatch', () => {
  it('performs GET requests with auth and prints the payload verbatim', async () => {
    let authorization: string | null = null
    let brandHeader: string | null = null
    server.use(
      http.get('https://brew.new/api/v1/fields', ({ request }) => {
        authorization = request.headers.get('authorization')
        brandHeader = request.headers.get('x-brand-id')
        return HttpResponse.json({ data: [{ name: 'plan' }] })
      })
    )
    const result = await runCli(['api', 'GET', '/v1/fields'], { env: env() })
    expect(result.code).toBe(0)
    expect(result.json).toEqual({ data: [{ name: 'plan' }] })
    expect(authorization).toBe(`Bearer ${KEY}`)
    expect(brandHeader).toBeNull()
  })

  it('adds X-Brand-Id on brand-scoped paths but not org-level paths', async () => {
    const seen: Record<string, string | null> = {}
    server.use(
      http.get('https://brew.new/api/v1/fields', ({ request }) => {
        seen.fields = request.headers.get('x-brand-id')
        return HttpResponse.json({ data: [] })
      }),
      http.get('https://brew.new/api/v1/usage', ({ request }) => {
        seen.usage = request.headers.get('x-brand-id')
        return HttpResponse.json({ plan: 'growth' })
      })
    )
    const testEnv = env({ BREW_BRAND_ID: 'bd_42' })
    await runCli(['api', 'GET', '/v1/fields'], { env: testEnv })
    await runCli(['api', 'GET', '/v1/usage'], { env: testEnv })
    expect(seen.fields).toBe('bd_42')
    expect(seen.usage).toBeNull()
  })

  it('gates non-GET requests behind the confirmation protocol', async () => {
    const result = await runCli(
      ['api', 'POST', '/v1/contacts/search', '--data', '{"limit":1}'],
      { env: env() }
    )
    expect(result.code).toBe(4)
    const envelope = result.json as Record<string, unknown>
    expect(envelope.confirmationRequired).toBe(true)
    expect(String(envelope.confirmCommand)).toContain('--yes')
    expect(String(envelope.confirmCommand)).toContain(
      'api POST /v1/contacts/search'
    )
  })

  it('sends the JSON body and idempotency key when confirmed', async () => {
    let body: unknown
    let idempotency: string | null = null
    server.use(
      http.post(
        'https://brew.new/api/v1/contacts/search',
        async ({ request }) => {
          body = await request.json()
          idempotency = request.headers.get('idempotency-key')
          return HttpResponse.json({ data: [], pagination: { cursor: null } })
        }
      )
    )
    const result = await runCli(
      [
        'api',
        'POST',
        '/v1/contacts/search',
        '--data',
        '{"limit":1}',
        '--idempotency-key',
        'idem-1',
        '--yes',
      ],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ limit: 1 })
    expect(idempotency).toBe('idem-1')
  })

  it('reads the body from stdin when --data is -', async () => {
    let body: unknown
    server.use(
      http.post(
        'https://brew.new/api/v1/contacts/search',
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ data: [] })
        }
      )
    )
    const result = await runCli(
      ['api', 'POST', '/v1/contacts/search', '--data', '-', '--yes'],
      { env: env(), stdin: '{"query":"jane"}' }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ query: 'jane' })
  })

  it('maps API error envelopes to exit 1 with requestId', async () => {
    server.use(
      http.get('https://brew.new/api/v1/fields', () =>
        HttpResponse.json(
          {
            error: {
              code: 'BRAND_ID_REQUIRED',
              type: 'invalid_request',
              message: 'Organization-scoped keys must name a brand.',
              suggestion: 'Pass --brand or set BREW_BRAND_ID.',
            },
          },
          { status: 400, headers: { 'x-request-id': 'req_9' } }
        )
      )
    )
    const result = await runCli(['api', 'GET', '/v1/fields'], { env: env() })
    expect(result.code).toBe(1)
    const parsed = JSON.parse(result.stderr) as {
      error: Record<string, unknown>
    }
    expect(parsed.error.code).toBe('BRAND_ID_REQUIRED')
    expect(parsed.error.requestId).toBe('req_9')
  })

  it('rejects --data on GET with a usage error', async () => {
    const result = await runCli(
      ['api', 'GET', '/v1/fields', '--data', '{"a":1}'],
      { env: env() }
    )
    expect(result.code).toBe(2)
  })

  it('keeps query-string health calls anonymous', async () => {
    server.use(
      http.get('https://brew.new/api/v1/health', () =>
        HttpResponse.json({ status: 'ok' })
      )
    )
    const result = await runCli(['api', 'GET', '/v1/health?verbose=1'], {
      env: {
        BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
      },
    })
    expect(result.code).toBe(0)
  })

  it('rejects malformed --data with a usage error', async () => {
    const result = await runCli(
      ['api', 'POST', '/v1/contacts/search', '--data', '{nope', '--yes'],
      { env: env() }
    )
    expect(result.code).toBe(2)
  })

  it('returns raw text for non-JSON endpoints', async () => {
    server.use(
      http.get('https://brew.new/api/v1/llms.txt', () =>
        HttpResponse.text('# Brew API agent guide')
      )
    )
    const result = await runCli(['api', 'GET', '/v1/llms.txt'], {
      env: env(),
    })
    expect(result.code).toBe(0)
    expect(result.json).toBe('# Brew API agent guide')
  })
})
