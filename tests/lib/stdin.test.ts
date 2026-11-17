import { getEventListeners } from 'node:events'
import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { readStdinText } from '../../src/lib/stdin'

describe('readStdinText', () => {
  it('reads UTF-8 through EOF and removes its abort listener', async () => {
    const stream = new PassThrough()
    const controller = new AbortController()
    const pending = readStdinText({ stream, signal: controller.signal })
    const input = Buffer.from('Hello ☕')
    stream.write(input.subarray(0, 7))
    stream.end(input.subarray(7))

    await expect(pending).resolves.toBe('Hello ☕')
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
  })

  it('refuses bytes that are not UTF-8 instead of replacing them', async () => {
    const stream = new PassThrough()
    const controller = new AbortController()
    const pending = readStdinText({ stream, signal: controller.signal })
    const rejected = expect(pending).rejects.toThrow(
      'stdin is not UTF-8 (line 2 has byte 0xE9), so nothing was sent.'
    )
    stream.end(
      Buffer.from('email,firstName\na@example.com,Jos\xe9\n', 'latin1')
    )

    await rejected
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
  })

  it('closes open input on command abort and preserves the reason', async () => {
    const stream = new PassThrough()
    const controller = new AbortController()
    const reason = new Error('Command deadline passed')
    const pending = readStdinText({ stream, signal: controller.signal })
    const rejected = expect(pending).rejects.toBe(reason)
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(1)
    controller.abort(reason)

    await rejected
    expect(stream.destroyed).toBe(true)
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
  })

  it('closes pre-aborted input without attaching an abort listener', async () => {
    const stream = new PassThrough()
    const controller = new AbortController()
    const reason = new Error('Command already interrupted')
    controller.abort(reason)

    await expect(
      readStdinText({ stream, signal: controller.signal })
    ).rejects.toBe(reason)
    expect(stream.destroyed).toBe(true)
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
  })

  it('propagates input failures and removes its abort listener', async () => {
    const stream = new PassThrough()
    const controller = new AbortController()
    const failure = new Error('Input connection dropped')
    const pending = readStdinText({ stream, signal: controller.signal })
    const rejected = expect(pending).rejects.toBe(failure)
    stream.destroy(failure)

    await rejected
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
  })
})
