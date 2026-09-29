import { describe, expect, it } from 'vitest'
import { CliUsageError } from '../../src/lib/errors'
import {
  anySignal,
  apiPathOf,
  createTransportState,
  parseMaxRetriesFlag,
  parseTimeoutFlag,
  recordingFetch,
  resolveBudget,
} from '../../src/lib/transport'

describe('parseTimeoutFlag', () => {
  it.each([
    ['90', 90_000],
    ['90s', 90_000],
    ['1500ms', 1500],
    ['5m', 300_000],
    ['1h', 3_600_000],
    ['0.5s', 500],
  ])('reads %s as %i ms', (value, ms) => {
    expect(parseTimeoutFlag(value)).toBe(ms)
  })

  it('is undefined when the flag is absent', () => {
    expect(parseTimeoutFlag(undefined)).toBeUndefined()
  })

  it.each(['0', 'abc', '-5s', '25h', '10d', ''])(
    'refuses %j as a usage error',
    (value) => {
      expect(() => parseTimeoutFlag(value)).toThrow(CliUsageError)
    }
  )
})

describe('parseMaxRetriesFlag', () => {
  it.each([
    ['0', 0],
    ['2', 2],
    ['10', 10],
  ])('reads %s', (value, retries) => {
    expect(parseMaxRetriesFlag(value)).toBe(retries)
  })

  it.each(['-1', '11', '1.5', 'x', ''])('refuses %j', (value) => {
    expect(() => parseMaxRetriesFlag(value)).toThrow(CliUsageError)
  })
})

describe('resolveBudget', () => {
  it('lets an explicit --timeout bound the command and each attempt', () => {
    expect(
      resolveBudget({ timeoutMs: 60_000, defaultTimeoutMs: 240_000 })
    ).toEqual({ deadlineMs: 60_000, attemptMs: 60_000 })
  })

  it('uses a long-running command default as the deadline alone', () => {
    expect(
      resolveBudget({ timeoutMs: undefined, defaultTimeoutMs: 240_000 })
    ).toEqual({ deadlineMs: 240_000, attemptMs: undefined })
  })

  it('sets no deadline when there is neither', () => {
    expect(
      resolveBudget({ timeoutMs: undefined, defaultTimeoutMs: undefined })
    ).toEqual({ deadlineMs: undefined, attemptMs: undefined })
  })
})

describe('anySignal', () => {
  it('aborts with the reason of the source that aborted', () => {
    const first = new AbortController()
    const second = new AbortController()
    const { signal } = anySignal([first.signal, second.signal])

    second.abort('second')

    expect(signal.aborted).toBe(true)
    // (Which reason wins when BOTH abort is not asserted: Node's native
    // AbortSignal.any reports a listener-less composite's reason in source
    // order, not abort order.)
    expect(signal.reason).toBe('second')
  })

  it('is already aborted when a source is', () => {
    const done = new AbortController()
    done.abort('early')

    const { signal } = anySignal([new AbortController().signal, done.signal])

    expect(signal.reason).toBe('early')
  })

  it('works without AbortSignal.any (Node 20.0–20.2), and releases', () => {
    const original = AbortSignal.any
    // biome-ignore lint/suspicious/noExplicitAny: simulating an older runtime
    ;(AbortSignal as any).any = undefined
    try {
      const source = new AbortController()
      const combined = anySignal([source.signal, new AbortController().signal])
      source.abort('stop')
      expect(combined.signal.reason).toBe('stop')

      const later = new AbortController()
      const released = anySignal([later.signal, new AbortController().signal])
      released.release()
      later.abort('ignored')
      expect(released.signal.aborted).toBe(false)
    } finally {
      AbortSignal.any = original
    }
  })

  it('passes a single signal through untouched', () => {
    const only = new AbortController().signal
    expect(anySignal([only, undefined]).signal).toBe(only)
  })
})

describe('recordingFetch', () => {
  it('records method, API path and key, and counts attempts', async () => {
    const state = createTransportState()
    const original = globalThis.fetch
    globalThis.fetch = () => Promise.resolve(new Response('{}'))
    try {
      const fetch = recordingFetch(state)
      await fetch('https://brew.new/api/v1/emails?x=1', {
        method: 'POST',
        headers: { 'idempotency-key': 'k1' },
      })
      await fetch('https://brew.new/api/v1/emails?x=1', { method: 'POST' })
    } finally {
      globalThis.fetch = original
    }
    expect(state.attempts()).toBe(2)
    expect(state.lastRequest()).toEqual({
      method: 'POST',
      path: '/v1/emails?x=1',
      idempotencyKey: undefined,
    })
  })
})

describe('apiPathOf', () => {
  it('names the route from /v1/ on, whatever the base URL adds', () => {
    expect(apiPathOf(new URL('https://brew.new/api/v1/contacts?limit=5'))).toBe(
      '/v1/contacts?limit=5'
    )
    expect(apiPathOf(new URL('http://127.0.0.1:3000/tunnel/api/v1/x'))).toBe(
      '/v1/x'
    )
  })
})
