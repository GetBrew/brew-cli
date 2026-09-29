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

  it('flags invalid credentials without hiding the rest of the report', async () => {
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
          { status: 401 }
        )
      )
    )
    const result = await runCli(['doctor'], { env: env() })
    expect(result.code).toBe(1)
    const data = result.json as { ok: boolean; authValid: boolean }
    expect(data.ok).toBe(false)
    expect(data.authValid).toBe(false)
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
