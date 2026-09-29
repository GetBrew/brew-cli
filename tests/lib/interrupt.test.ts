import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CliInterruptError } from '../../src/lib/errors'
import { createInterrupter } from '../../src/lib/interrupt'

function harness(graceMs?: number) {
  const source = new EventEmitter()
  const exits: number[] = []
  let stderr = ''
  const stream = new PassThrough()
  stream.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
  })
  const interrupter = createInterrupter({
    source,
    stderr: stream,
    exit: (code) => {
      exits.push(code)
    },
    ...(graceMs === undefined ? {} : { graceMs }),
  })
  return { source, exits, interrupter, stderr: () => stderr }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('createInterrupter', () => {
  it('aborts the signal with a CliInterruptError on the first SIGINT', () => {
    const { source, interrupter, exits } = harness()

    source.emit('SIGINT')

    expect(interrupter.signal.aborted).toBe(true)
    expect(interrupter.signal.reason).toBeInstanceOf(CliInterruptError)
    expect((interrupter.signal.reason as CliInterruptError).signal).toBe(
      'SIGINT'
    )
    expect(interrupter.received()).toBe('SIGINT')
    expect(exits).toEqual([])
    interrupter.settle()
  })

  it('exits 130 at once on a second SIGINT', () => {
    const { source, interrupter, exits, stderr } = harness()

    source.emit('SIGINT')
    source.emit('SIGINT')

    expect(exits).toEqual([130])
    expect(stderr()).toContain('SIGINT received twice')
    interrupter.settle()
  })

  it('exits 143 for SIGTERM when the command does not stop in time', () => {
    vi.useFakeTimers()
    const { source, exits, stderr } = harness(3000)

    source.emit('SIGTERM')
    vi.advanceTimersByTime(3000)

    expect(exits).toEqual([143])
    expect(stderr()).toContain('still stopping 3s after SIGTERM')
  })

  it('does not force an exit once the command has settled', () => {
    vi.useFakeTimers()
    const { source, interrupter, exits } = harness(3000)

    source.emit('SIGINT')
    interrupter.settle()
    vi.advanceTimersByTime(10_000)

    expect(exits).toEqual([])
  })

  it('lets a prompt report the Ctrl-C it swallowed', () => {
    const { interrupter } = harness()

    interrupter.trigger('SIGINT')

    expect(interrupter.signal.aborted).toBe(true)
    interrupter.settle()
  })
})
