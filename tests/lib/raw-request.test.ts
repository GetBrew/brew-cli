import { PassThrough } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { rawRequest } from '../../src/lib/raw-request'
import type { CliContext } from '../../src/lib/types'

const API_KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'

function context(): CliContext {
  return {
    io: {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      isTtyOut: false,
      isTtyIn: false,
      env: { BREW_API_KEY: API_KEY },
      readStdin: async () => '',
      readLine: async () => '',
    },
    mode: 'json',
    globals: {
      json: true,
      quiet: true,
      yes: false,
      apiKey: undefined,
      brand: undefined,
      apiUrl: undefined,
    },
    client: () => {
      throw new Error('SDK client is not used by rawRequest')
    },
    rawArgv: [],
  }
}

describe('rawRequest', () => {
  it('forwards a caller-provided abort signal to fetch', async () => {
    const controller = new AbortController()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      })
    )

    const result = await rawRequest<{ readonly ok: boolean }>(context(), {
      method: 'POST',
      path: '/v1/emails/audit',
      body: { emailHtml: '<p>Hello</p>' },
      signal: controller.signal,
    })

    expect(result).toEqual({ ok: true })
    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBe(controller.signal)
  })
})
