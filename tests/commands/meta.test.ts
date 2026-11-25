import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { configPath, readConfig, writeConfig } from '../../src/lib/config-store'
import { CliInterruptError } from '../../src/lib/errors'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const USAGE = { plan: 'growth', credits: { balance: 420 } }

function tempConfigEnv(
  extra: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    ...extra,
  }
}

describe('health', () => {
  it('works without any credentials', async () => {
    server.use(
      http.get('https://brew.new/api/v1/health', () =>
        HttpResponse.json({ status: 'ok', version: '1' })
      )
    )
    const result = await runCli(['health'], { env: tempConfigEnv() })
    expect(result.code).toBe(0)
    expect(result.json).toEqual({ status: 'ok', version: '1' })
  })
})

describe('usage', () => {
  it('exits 3 with a structured error when no key is configured', async () => {
    const result = await runCli(['usage'], { env: tempConfigEnv() })
    expect(result.code).toBe(3)
    expect(result.stdout).toBe('')
    const parsed = JSON.parse(result.stderr) as {
      error: { code: string; suggestion: string }
    }
    expect(parsed.error.code).toBe('CLI_AUTH')
    expect(parsed.error.suggestion).toContain('brew-cli login')
  })

  it('sends the bearer key from the environment', async () => {
    let authorization: string | null = null
    server.use(
      http.get('https://brew.new/api/v1/usage', ({ request }) => {
        authorization = request.headers.get('authorization')
        return HttpResponse.json(USAGE)
      })
    )
    const result = await runCli(['usage'], {
      env: tempConfigEnv({ BREW_API_KEY: KEY }),
    })
    expect(result.code).toBe(0)
    expect(result.json).toEqual(USAGE)
    expect(authorization).toBe(`Bearer ${KEY}`)
  })

  it('prefers the --api-key flag over the environment', async () => {
    let authorization: string | null = null
    server.use(
      http.get('https://brew.new/api/v1/usage', ({ request }) => {
        authorization = request.headers.get('authorization')
        return HttpResponse.json(USAGE)
      })
    )
    const flagKey = 'brew_flagflagflagflagflagflag0001'
    const result = await runCli(['usage', '--api-key', flagKey], {
      env: tempConfigEnv({ BREW_API_KEY: KEY }),
    })
    expect(result.code).toBe(0)
    expect(authorization).toBe(`Bearer ${flagKey}`)
  })

  it('honors --api-url for other environments', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/usage', () =>
        HttpResponse.json(USAGE)
      )
    )
    const result = await runCli(
      ['usage', '--api-url', 'http://localhost:3000/api'],
      { env: tempConfigEnv({ BREW_API_KEY: KEY }) }
    )
    expect(result.code).toBe(0)
  })
})

describe('whoami', () => {
  it('reports the resolved credential with a masked key', async () => {
    server.use(
      http.get('https://brew.new/api/v1/usage', () => HttpResponse.json(USAGE))
    )
    const result = await runCli(['whoami'], {
      env: tempConfigEnv({ BREW_API_KEY: KEY, BREW_BRAND_ID: 'bd_9' }),
    })
    expect(result.code).toBe(0)
    const data = result.json as Record<string, unknown>
    expect(data.apiKeySource).toBe('env')
    expect(data.brandId).toBe('bd_9')
    expect(data.apiKey).toBe('brew_abc…345')
    expect(String(data.apiKey)).not.toContain(KEY)
  })

  it('degrades to usage:null on a server outage but keeps auth errors fatal', async () => {
    server.use(
      http.get('https://brew.new/api/v1/usage', () =>
        HttpResponse.json(
          {
            error: {
              code: 'INTERNAL_ERROR',
              type: 'internal_error',
              message: 'An unexpected error occurred.',
            },
          },
          { status: 500 }
        )
      )
    )
    const degraded = await runCli(['whoami'], {
      env: tempConfigEnv({ BREW_API_KEY: KEY }),
    })
    expect(degraded.code).toBe(0)
    expect((degraded.json as { usage: unknown }).usage).toBeNull()
    expect(degraded.stderr).toContain('could not reach /v1/usage')

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
    const unauthorized = await runCli(['whoami'], {
      env: tempConfigEnv({ BREW_API_KEY: KEY }),
    })
    expect(unauthorized.code).toBe(3)
  })

  it('stops with CLI_TIMEOUT when its own --timeout expires, never a degraded exit 0', async () => {
    server.use(
      http.get(
        'https://brew.new/api/v1/usage',
        () => new Promise<Response>(() => undefined)
      )
    )

    const result = await runCli(['whoami', '--timeout', '300ms'], {
      env: tempConfigEnv({ BREW_API_KEY: KEY }),
    })

    expect(result.code).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).not.toContain('could not reach /v1/usage')
    const line = result.stderr.trim().split('\n').at(-1) ?? ''
    expect((JSON.parse(line) as { error: { code: string } }).error.code).toBe(
      'CLI_TIMEOUT'
    )
  })

  it('stops on Ctrl-C, never a degraded exit 0', async () => {
    const controller = new AbortController()
    server.use(
      http.get('https://brew.new/api/v1/usage', () => {
        controller.abort(new CliInterruptError('SIGINT'))
        return new Promise<Response>(() => undefined)
      })
    )

    const result = await runCli(['whoami'], {
      env: tempConfigEnv({ BREW_API_KEY: KEY }),
      signal: controller.signal,
    })

    expect(result.code).toBe(130)
    expect(result.stdout).toBe('')
  })
})

describe('login / logout', () => {
  it('validates the key against the API and stores it 0600', async () => {
    server.use(
      http.get('https://brew.new/api/v1/usage', () => HttpResponse.json(USAGE))
    )
    const env = tempConfigEnv()
    const result = await runCli(['login', '--api-key', KEY], { env })
    expect(result.code).toBe(0)
    const data = result.json as Record<string, unknown>
    expect(data.loggedIn).toBe(true)
    expect(readConfig(env).apiKey).toBe(KEY)

    const logout = await runCli(['logout'], { env })
    expect(logout.code).toBe(0)
    expect(readConfig(env).apiKey).toBeUndefined()
  })

  it('accepts a key piped on stdin', async () => {
    server.use(
      http.get('https://brew.new/api/v1/usage', () => HttpResponse.json(USAGE))
    )
    const env = tempConfigEnv()
    const result = await runCli(['login'], { env, stdin: `${KEY}\n` })
    expect(result.code).toBe(0)
    expect(readConfig(env).apiKey).toBe(KEY)
  })

  it('rejects an invalid key with exit 3 and stores nothing', async () => {
    server.use(
      http.get('https://brew.new/api/v1/usage', () =>
        HttpResponse.json(
          {
            error: {
              code: 'INVALID_API_KEY',
              type: 'authentication_error',
              message: 'Invalid API key.',
              suggestion: 'Create a key at https://brew.new/settings/api',
              docs: 'https://docs.brew.new',
            },
          },
          { status: 401 }
        )
      )
    )
    const env = tempConfigEnv()
    const result = await runCli(
      ['login', '--api-key', 'brew_wrongwrongwrongwrong0000'],
      {
        env,
      }
    )
    expect(result.code).toBe(3)
    expect(readConfig(env).apiKey).toBeUndefined()
    const parsed = JSON.parse(result.stderr) as { error: { code: string } }
    expect(parsed.error.code).toBe('INVALID_API_KEY')
  })

  it('keeps a saved key bound to its login origin when the API URL changes', async () => {
    const env = tempConfigEnv()
    writeConfig(env, { apiKey: KEY, apiKeyOrigin: 'https://brew.new' })
    let requests = 0
    server.use(
      http.get('https://staging.example/api/v1/usage', () => {
        requests += 1
        return HttpResponse.json(USAGE)
      })
    )
    const overridden = await runCli(
      ['usage', '--api-url', 'https://staging.example/api'],
      { env }
    )
    expect(overridden.code).toBe(3)
    expect(requests).toBe(0)

    expect(
      (
        await runCli(
          ['config', 'set', 'apiUrl', 'https://staging.example/api'],
          { env }
        )
      ).code
    ).toBe(0)
    expect(readConfig(env).apiKeyOrigin).toBe('https://brew.new')
    expect((await runCli(['usage'], { env })).code).toBe(3)
    expect(requests).toBe(0)

    expect((await runCli(['usage', '--api-key', KEY], { env })).code).toBe(0)
    expect(requests).toBe(1)
  })

  it('requires renewed login when a saved key has no verified origin', async () => {
    const env = tempConfigEnv()
    writeConfig(env, { apiKey: KEY })
    let requests = 0
    server.use(
      http.get('https://brew.new/api/v1/usage', () => {
        requests += 1
        return HttpResponse.json(USAGE)
      })
    )
    const unverified = await runCli(['usage'], { env })
    expect(unverified.code).toBe(3)
    expect(unverified.stderr).toContain('origin was never recorded')
    expect(requests).toBe(0)

    expect((await runCli(['login', '--api-key', KEY], { env })).code).toBe(0)
    expect(readConfig(env).apiKeyOrigin).toBe('https://brew.new')
    expect((await runCli(['usage'], { env })).code).toBe(0)
    expect(requests).toBe(2)
  })

  it('lets a user repair an obsolete cleartext URL without reusing its key', async () => {
    const env = tempConfigEnv()
    writeConfig(env, { apiKey: KEY, apiUrl: 'http://staging.example/api' })
    expect((await runCli(['usage'], { env })).code).toBe(2)
    expect(
      (
        await runCli(
          ['config', 'set', 'apiUrl', 'https://staging.example/api'],
          { env }
        )
      ).code
    ).toBe(0)
    expect((await runCli(['usage'], { env })).code).toBe(3)
  })

  it('discards legacy URL passwords when repairing the API URL', async () => {
    const env = tempConfigEnv()
    const oldPassword = 'old-example-password'
    writeConfig(env, {
      apiKey: KEY,
      apiUrl: `https://example:${oldPassword}@staging.example/api`,
    })

    const result = await runCli(
      ['config', 'set', 'apiUrl', 'https://staging.example/api'],
      { env }
    )
    expect(result.code).toBe(0)
    expect(readFileSync(configPath(env), 'utf8')).not.toContain(oldPassword)
    expect((await runCli(['usage'], { env })).code).toBe(3)
  })

  it('exits 2 when non-interactive with no key source', async () => {
    const result = await runCli(['login'], { env: tempConfigEnv() })
    expect(result.code).toBe(2)
  })
})

describe('config', () => {
  it('sets, lists (masked), and unsets values', async () => {
    const env = tempConfigEnv()
    server.use(
      http.get('https://brew.new/api/v1/usage', () => HttpResponse.json(USAGE))
    )
    await runCli(['login', '--api-key', KEY], { env })

    const set = await runCli(['config', 'set', 'brandId', 'bd_7'], { env })
    expect(set.code).toBe(0)

    const list = await runCli(['config', 'list'], { env })
    const data = list.json as Record<string, unknown>
    expect(data.brandId).toBe('bd_7')
    expect(data.apiKey).toBe('brew_abc…345')

    const unset = await runCli(['config', 'unset', 'brandId'], { env })
    expect(unset.code).toBe(0)
    expect(readConfig(env).brandId).toBeUndefined()
  })

  it('refuses to set the apiKey directly', async () => {
    const result = await runCli(['config', 'set', 'apiKey', 'brew_x'], {
      env: tempConfigEnv(),
    })
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('login')
  })
})
