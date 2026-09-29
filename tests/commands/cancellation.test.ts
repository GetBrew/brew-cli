import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { CliInterruptError, type InterruptSignal } from '../../src/lib/errors'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

/**
 * SIGINT/SIGTERM while a request is in flight. The handler aborts the
 * injected signal exactly when the request arrives and never answers, so
 * the interrupt lands mid-request with no timers.
 */

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const API = 'https://brew.new/api'

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

/** Answer nothing; interrupt the process the moment the request lands. */
function interruptOnRequest(
  controller: AbortController,
  signal: InterruptSignal = 'SIGINT'
): () => Promise<Response> {
  return () => {
    controller.abort(new CliInterruptError(signal))
    return new Promise<Response>(() => undefined)
  }
}

describe('Ctrl-C / SIGTERM mid-request', () => {
  it('stops a write, exits 130, and names the key that replays it', async () => {
    const controller = new AbortController()
    let sentKey: string | null = null
    server.use(
      http.post(`${API}/v1/emails`, ({ request }) => {
        sentKey = request.headers.get('idempotency-key')
        return interruptOnRequest(controller)()
      })
    )

    const result = await runCli(
      ['emails', 'generate', '--prompt', 'Welcome', '--api-key', KEY],
      { env: env(), signal: controller.signal }
    )

    expect(result.code).toBe(130)
    expect(result.stdout).toBe('')
    const error = envelopeOf(result.stderr)
    expect(error.code).toBe('CLI_INTERRUPTED')
    expect(error.type).toBe('cancelled')
    expect(error.message).toBe(
      'Interrupted (SIGINT) while waiting for POST /v1/emails.'
    )
    expect(sentKey).toEqual(expect.any(String))
    expect(error.idempotencyKey).toBe(sentKey)
    expect(error.retryCommand).toBe(
      `brew-cli emails generate --prompt Welcome --idempotency-key ${String(sentKey)}`
    )
    expect(String(error.retryCommand)).not.toContain(KEY)
    expect(String(error.suggestion)).toContain('may still complete')
  })

  it('exits 143 for SIGTERM', async () => {
    const controller = new AbortController()
    server.use(
      http.post(`${API}/v1/emails`, interruptOnRequest(controller, 'SIGTERM'))
    )

    const result = await runCli(['emails', 'generate', '--prompt', 'Hi'], {
      env: env(),
      signal: controller.signal,
    })

    expect(result.code).toBe(143)
    const error = envelopeOf(result.stderr)
    expect(error.message).toBe(
      'Terminated (SIGTERM) while waiting for POST /v1/emails.'
    )
  })

  it('says a read changed nothing, and offers no key', async () => {
    const controller = new AbortController()
    server.use(http.get(`${API}/v1/domains`, interruptOnRequest(controller)))

    const result = await runCli(['domains', 'list'], {
      env: env(),
      signal: controller.signal,
    })

    expect(result.code).toBe(130)
    const error = envelopeOf(result.stderr)
    expect(error.suggestion).toBe('It only reads; nothing was changed.')
    expect(error.idempotencyKey).toBeUndefined()
    expect(error.retryCommand).toBeUndefined()
  })

  it('tells a non-replaying write to check state before running it again', async () => {
    const controller = new AbortController()
    server.use(
      http.patch(`${API}/v1/audiences/aud_1`, interruptOnRequest(controller))
    )

    const result = await runCli(
      ['audiences', 'update', 'aud_1', '--name', 'VIP'],
      { env: env(), signal: controller.signal }
    )

    expect(result.code).toBe(130)
    const error = envelopeOf(result.stderr)
    expect(String(error.suggestion)).toContain('does not replay')
    expect(error.retryCommand).toBeUndefined()
  })

  it('sends nothing when interrupted before the request', async () => {
    const controller = new AbortController()
    controller.abort(new CliInterruptError('SIGINT'))

    // No handler: MSW fails the test if any request goes out.
    const result = await runCli(['emails', 'generate', '--prompt', 'Hi'], {
      env: env(),
      signal: controller.signal,
    })

    expect(result.code).toBe(130)
    const error = envelopeOf(result.stderr)
    expect(error.message).toBe(
      'Interrupted (SIGINT) before any request was sent.'
    )
    expect(error.suggestion).toBe('Nothing was sent.')
  })

  it('stops an --all drain between pages and reports where to resume', async () => {
    const controller = new AbortController()
    let requests = 0
    server.use(
      http.get(`${API}/v1/domains`, ({ request }) => {
        requests += 1
        const cursor = new URL(request.url).searchParams.get('cursor')
        if (cursor === null) {
          return HttpResponse.json({
            data: [{ domainId: 'dom_1' }, { domainId: 'dom_2' }],
            pagination: { limit: 2, cursor: 'c2', hasMore: true },
          })
        }
        return interruptOnRequest(controller)()
      })
    )

    const result = await runCli(['domains', 'list', '--all'], {
      env: env(),
      signal: controller.signal,
    })

    expect(result.code).toBe(130)
    expect(result.stdout).toBe('')
    expect(requests).toBe(2)
    const error = envelopeOf(result.stderr)
    expect(error.progress).toEqual({
      rowsFetched: 2,
      pagesFetched: 1,
      resumeCursor: 'c2',
    })
  })

  it('treats a raw POST to a read route as the read it is', async () => {
    const controller = new AbortController()
    server.use(
      http.post(`${API}/v1/contacts/search`, interruptOnRequest(controller))
    )

    const result = await runCli(
      ['api', 'POST', '/v1/contacts/search', '--data', '{"limit":5}', '--yes'],
      { env: env(), signal: controller.signal }
    )

    expect(result.code).toBe(130)
    const error = envelopeOf(result.stderr)
    expect(error.suggestion).toBe('It only reads; nothing was changed.')
    expect(error.retryCommand).toBeUndefined()
  })

  it('reminds a stdin-fed write to pipe the same input to its re-run', async () => {
    const controller = new AbortController()
    server.use(http.post(`${API}/v1/emails`, interruptOnRequest(controller)))

    const result = await runCli(['emails', 'generate', '--input', '-'], {
      env: env(),
      signal: controller.signal,
      stdin: JSON.stringify({ prompt: 'Welcome' }),
    })

    expect(result.code).toBe(130)
    const error = envelopeOf(result.stderr)
    expect(String(error.suggestion)).toContain(
      'pipe the same input to it again'
    )
    expect(String(error.retryCommand)).toContain('--input -')
  })

  it('prints the re-run command for a human', async () => {
    const controller = new AbortController()
    server.use(http.post(`${API}/v1/emails`, interruptOnRequest(controller)))

    const result = await runCli(
      ['emails', 'generate', '--prompt', 'Hi', '--idempotency-key', 'k-7'],
      { env: env(), signal: controller.signal, ttyOut: true }
    )

    expect(result.code).toBe(130)
    expect(result.stderr).toContain(
      'brew-cli: Interrupted (SIGINT) while waiting for POST /v1/emails.'
    )
    expect(result.stderr).toContain(
      'Re-run: brew-cli emails generate --prompt Hi --idempotency-key k-7'
    )
  })
})
