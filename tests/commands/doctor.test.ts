import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { CliInterruptError } from '../../src/lib/errors'
import { ALL_COMMANDS } from '../../src/registry'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'

function env(): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    BREW_API_KEY: KEY,
  }
}

/** The JSON error envelope: the last stderr line (progress lines come first). */
function envelopeOf(stderr: string): Record<string, unknown> {
  const line = stderr.trim().split('\n').at(-1) ?? ''
  return (JSON.parse(line) as { error: Record<string, unknown> }).error
}

function liveEndpoints(): Array<{ method: string; path: string }> {
  const seen = new Set<string>()
  const endpoints: Array<{ method: string; path: string }> = []
  for (const spec of ALL_COMMANDS) {
    if (spec.route === undefined) {
      continue
    }
    const key = `${spec.route.method} ${spec.route.path}`
    if (!seen.has(key)) {
      seen.add(key)
      endpoints.push({ method: spec.route.method, path: spec.route.path })
    }
  }
  return endpoints
}

function mountApi(endpoints: Array<{ method: string; path: string }>): void {
  server.use(
    http.get('https://brew.new/api/v1/health', () =>
      HttpResponse.json({ status: 'ok', version: 'v1' })
    ),
    http.get('https://brew.new/api/v1/usage', () =>
      HttpResponse.json({ plan: { key: 'growth' } })
    ),
    http.get('https://brew.new/api/v1/help', () =>
      HttpResponse.json({ endpoints })
    )
  )
}

describe('doctor', () => {
  it('reports healthy and exits 0 when auth works and the surface is in sync', async () => {
    mountApi(liveEndpoints())
    const result = await runCli(['doctor'], { env: env() })
    expect(result.code).toBe(0)
    const data = result.json as {
      ok: boolean
      authValid: boolean
      plan: string
      surface: { missingLocally: string[] }
    }
    expect(data.ok).toBe(true)
    expect(data.authValid).toBe(true)
    expect(data.plan).toBe('growth')
    expect(data.surface.missingLocally).toEqual([])
    expect(data).not.toHaveProperty('authCheckError')
  })

  it('exits 1 and names the missing operations on drift', async () => {
    mountApi([
      ...liveEndpoints(),
      { method: 'POST', path: '/v1/emails/{emailId}/translate' },
    ])
    const result = await runCli(['doctor'], { env: env() })
    expect(result.code).toBe(1)
    const data = result.json as {
      ok: boolean
      surface: { missingLocally: string[] }
    }
    expect(data.ok).toBe(false)
    expect(data.surface.missingLocally).toEqual([
      'POST /v1/emails/{emailId}/translate',
    ])
  })

  it.each([401, 403])(
    'flags invalid credentials (%s) without hiding the rest of the report',
    async (status) => {
      mountApi(liveEndpoints())
      server.use(
        http.get('https://brew.new/api/v1/usage', () =>
          HttpResponse.json(
            {
              error: {
                code: 'INVALID_API_KEY',
                type: 'authentication_error',
                message: 'Invalid API key.',
              },
            },
            { status }
          )
        )
      )
      const result = await runCli(['doctor'], { env: env() })
      expect(result.code).toBe(1)
      const data = result.json as { ok: boolean; authValid: boolean }
      expect(data.ok).toBe(false)
      expect(data.authValid).toBe(false)
      expect(data).toHaveProperty('authCheckError', 'Invalid API key.')
    }
  )

  it.each([429, 500, 503])(
    'fails with unknown auth when the usage probe returns %s without retries',
    async (status) => {
      mountApi(liveEndpoints())
      let probes = 0
      server.use(
        http.get('https://brew.new/api/v1/usage', () => {
          probes += 1
          return HttpResponse.json(
            {
              error: {
                code: status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR',
                type: status === 429 ? 'rate_limit_error' : 'api_error',
                message: 'Usage check unavailable.',
              },
            },
            { status }
          )
        })
      )

      const result = await runCli(['doctor', '--max-retries', '0'], {
        env: env(),
      })

      expect(probes).toBe(1)
      expect(result.code).toBe(1)
      expect(result.json).toMatchObject({
        ok: false,
        reachable: true,
        authValid: null,
        authCheckError: 'Usage check unavailable.',
        surface: { checked: true, missingLocally: [] },
      })
    }
  )

  it('fails with an explanation when the auth probe loses its connection', async () => {
    mountApi(liveEndpoints())
    let probes = 0
    server.use(
      http.get('https://brew.new/api/v1/usage', () => {
        probes += 1
        return HttpResponse.error()
      })
    )

    const result = await runCli(['doctor', '--max-retries', '0'], {
      env: env(),
    })

    expect(probes).toBe(1)
    expect(result.code).toBe(1)
    expect(result.json).toMatchObject({
      ok: false,
      authValid: null,
      authCheckError: expect.any(String),
    })
  })

  it('explains an inconclusive auth check in the terminal report', async () => {
    mountApi(liveEndpoints())
    server.use(
      http.get('https://brew.new/api/v1/usage', () =>
        HttpResponse.json(
          {
            error: {
              code: 'RATE_LIMITED',
              type: 'rate_limit_error',
              message: 'Wait before checking usage again.',
            },
          },
          { status: 429 }
        )
      )
    )

    const result = await runCli(['doctor', '--max-retries', '0'], {
      env: env(),
      ttyOut: true,
    })

    expect(result.code).toBe(1)
    expect(result.stdout).toContain('??  auth')
    expect(result.stdout).toContain('Wait before checking usage again.')
  })

  it('reports healthy after the usage probe recovers on retry', async () => {
    mountApi(liveEndpoints())
    let probes = 0
    server.use(
      http.get('https://brew.new/api/v1/usage', () => {
        probes += 1
        if (probes === 1) {
          return HttpResponse.json(
            {
              error: {
                code: 'RATE_LIMITED',
                type: 'rate_limit_error',
                message: 'Try again.',
              },
            },
            { status: 429, headers: { 'Retry-After': '0' } }
          )
        }
        return HttpResponse.json({ plan: { key: 'growth' } })
      })
    )

    const result = await runCli(['doctor', '--max-retries', '1'], {
      env: env(),
    })

    expect(probes).toBe(2)
    expect(result.code).toBe(0)
    expect(result.json).toMatchObject({ ok: true, authValid: true })
    expect(result.json).not.toHaveProperty('authCheckError')
  })

  it('works without any key at all (anonymous checks only)', async () => {
    mountApi(liveEndpoints())
    const result = await runCli(['doctor'], {
      env: { BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-')) },
    })
    expect(result.code).toBe(0)
    const data = result.json as { ok: boolean; apiKey: null }
    expect(data.ok).toBe(true)
    expect(data.apiKey).toBeNull()
    expect(data).not.toHaveProperty('authCheckError')
  })

  it('omits the auth error when an unreachable API prevents its probe', async () => {
    mountApi(liveEndpoints())
    server.use(
      http.get('https://brew.new/api/v1/health', () => HttpResponse.error())
    )

    const result = await runCli(['doctor', '--max-retries', '0'], {
      env: env(),
    })

    expect(result.code).toBe(1)
    expect(result.json).toMatchObject({ ok: false, authValid: null })
    expect(result.json).toHaveProperty('reachabilityError')
    expect(result.json).not.toHaveProperty('authCheckError')
  })

  it('stops with CLI_TIMEOUT when its own --timeout expires mid-probe', async () => {
    mountApi(liveEndpoints())
    server.use(
      http.get(
        'https://brew.new/api/v1/usage',
        () => new Promise<Response>(() => undefined)
      )
    )

    const result = await runCli(['doctor', '--timeout', '300ms'], {
      env: env(),
    })

    // The caller's own budget ran out: that ends the command, it is not a
    // finding to report (and never an exit 0 with the auth check skipped).
    expect(result.code).toBe(1)
    expect(result.stdout).toBe('')
    expect(envelopeOf(result.stderr).code).toBe('CLI_TIMEOUT')
  })

  it('stops on Ctrl-C instead of reporting', async () => {
    const controller = new AbortController()
    mountApi(liveEndpoints())
    server.use(
      http.get('https://brew.new/api/v1/usage', () => {
        controller.abort(new CliInterruptError('SIGINT'))
        return new Promise<Response>(() => undefined)
      })
    )

    const result = await runCli(['doctor'], {
      env: env(),
      signal: controller.signal,
    })

    expect(result.code).toBe(130)
    expect(result.stdout).toBe('')
    expect(envelopeOf(result.stderr).code).toBe('CLI_INTERRUPTED')
  })
})
