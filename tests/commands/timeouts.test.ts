import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

/**
 * `--timeout`, `--max-retries`, the raw transport's deadline, and how
 * timeouts and failed connections are reported. Every stall here would hang
 * the suite on a transport that stops bounding the request at the headers,
 * so each carries an explicit test timeout.
 */

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const API = 'https://brew.new/api'
const STALL = { timeout: 5000 }

function env(): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    BREW_API_KEY: KEY,
  }
}

type Envelope = { error: Record<string, unknown> }

/** The JSON error envelope: the last stderr line (progress lines come first). */
function envelopeOf(stderr: string): Record<string, unknown> {
  const line = stderr.trim().split('\n').at(-1) ?? ''
  return (JSON.parse(line) as Envelope).error
}

const neverAnswers = (): Promise<Response> =>
  new Promise<Response>(() => undefined)

/** Headers and part of the JSON body, then nothing, ever. */
function stalledBody(): Response {
  return new HttpResponse(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"data":['))
      },
    }),
    { headers: { 'content-type': 'application/json' } }
  )
}

describe('--timeout', () => {
  it('bounds a request that never answers', STALL, async () => {
    server.use(http.get(`${API}/v1/domains`, neverAnswers))
    const started = performance.now()

    const result = await runCli(['domains', 'list', '--timeout', '200ms'], {
      env: env(),
    })

    expect(result.code).toBe(1)
    const error = envelopeOf(result.stderr)
    expect(error.code).toBe('CLI_TIMEOUT')
    expect(error.message).toBe(
      'No complete response within 200ms (GET /v1/domains).'
    )
    expect(performance.now() - started).toBeLessThan(3000)
  })

  it(
    'bounds a response whose body stalls after the headers',
    STALL,
    async () => {
      server.use(http.get(`${API}/v1/domains`, () => stalledBody()))

      const result = await runCli(['domains', 'list', '--timeout', '200ms'], {
        env: env(),
      })

      expect(result.code).toBe(1)
      const error = envelopeOf(result.stderr)
      expect(error.code).toBe('CLI_TIMEOUT')
    }
  )

  it('bounds the raw `api` transport too, body included', STALL, async () => {
    server.use(http.get(`${API}/v1/fields`, () => stalledBody()))

    const result = await runCli(
      ['api', 'GET', '/v1/fields', '--timeout', '200ms'],
      { env: env() }
    )

    expect(result.code).toBe(1)
    const error = envelopeOf(result.stderr)
    expect(error.code).toBe('CLI_TIMEOUT')
  })

  it(
    'shortens a long-running command default when explicit',
    STALL,
    async () => {
      server.use(http.post(`${API}/v1/emails`, neverAnswers))
      const started = performance.now()

      const result = await runCli(
        ['emails', 'generate', '--prompt', 'Hi', '--timeout', '200ms'],
        { env: env() }
      )

      expect(result.code).toBe(1)
      const error = envelopeOf(result.stderr)
      expect(error.code).toBe('CLI_TIMEOUT')
      // A timed-out keyed write names the key that replays it.
      expect(error.idempotencyKey).toEqual(expect.any(String))
      expect(String(error.retryCommand)).toContain('--idempotency-key')
      expect(performance.now() - started).toBeLessThan(3000)
    }
  )

  it.each(['abc', '0', '25h'])(
    'refuses --timeout %s as a usage error',
    async (value) => {
      const result = await runCli(['domains', 'list', '--timeout', value], {
        env: env(),
      })

      expect(result.code).toBe(2)
      expect(result.stderr).toContain('--timeout')
    }
  )
})

describe('--max-retries', () => {
  it.each([
    ['0', 1],
    ['2', 3],
  ])('--max-retries %s makes %i attempts', async (value, attempts) => {
    let calls = 0
    server.use(
      http.get(`${API}/v1/domains`, () => {
        calls += 1
        return new HttpResponse(null, { status: 503 })
      })
    )

    const result = await runCli(['domains', 'list', '--max-retries', value], {
      env: env(),
    })

    expect(result.code).toBe(1)
    expect(calls).toBe(attempts)
  })

  it.each(['-1', '11', 'x'])('refuses --max-retries %s', async (value) => {
    const result = await runCli(['domains', 'list', '--max-retries', value], {
      env: env(),
    })

    expect(result.code).toBe(2)
  })
})

describe('failed connections', () => {
  it('reports CLI_CONNECTION once the retries are spent', async () => {
    let calls = 0
    server.use(
      http.get(`${API}/v1/domains`, () => {
        calls += 1
        return HttpResponse.error()
      })
    )

    const result = await runCli(['domains', 'list', '--max-retries', '1'], {
      env: env(),
    })

    expect(result.code).toBe(1)
    expect(calls).toBe(2)
    const error = envelopeOf(result.stderr)
    expect(error.code).toBe('CLI_CONNECTION')
    expect(error.type).toBe('service_unavailable')
  })

  it('gives a raw POST a key, and names it when the connection fails', async () => {
    let sentKey: string | null = null
    server.use(
      http.post(`${API}/v1/emails`, ({ request }) => {
        sentKey = request.headers.get('idempotency-key')
        return HttpResponse.error()
      })
    )

    const result = await runCli(
      ['api', 'POST', '/v1/emails', '--data', '{"prompt":"Hi"}', '--yes'],
      { env: env() }
    )

    expect(result.code).toBe(1)
    expect(sentKey).toMatch(/^[0-9a-f-]{36}$/)
    const error = envelopeOf(result.stderr)
    expect(error.code).toBe('CLI_CONNECTION')
    // POST /v1/emails replays a keyed request (its command declares the
    // replaying --idempotency-key), so the raw call gets the replay advice.
    expect(error.idempotencyKey).toBe(sentKey)
    expect(String(error.retryCommand)).toBe(
      `brew-cli api POST /v1/emails --data '{"prompt":"Hi"}' --yes --idempotency-key ${String(sentKey)}`
    )
  })
})
