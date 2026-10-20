import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { automationsTestCommand } from '../../src/commands/automations/test'
import {
  enforceConfirmation,
  enforceStdinConfirmation,
} from '../../src/lib/confirm'
import { makeContext } from '../../src/lib/context'
import { CliInterruptError, CliTimeoutError } from '../../src/lib/errors'
import type { CliIo } from '../../src/lib/types'

const body = { testRecipient: 'qa@example.com' }

function interactiveContext(options: {
  input: string
  readLine: CliIo['readLine']
  readStdin?: CliIo['readStdin']
  signal?: AbortSignal
}) {
  const flags = { input: options.input, timeout: '100ms' }
  const ctx = makeContext({
    rawArgv: ['automations', 'test', 'am_1', '--input', options.input],
    flags,
    io: {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      isTtyOut: true,
      isTtyIn: true,
      env: {},
      readStdin: options.readStdin ?? (async () => JSON.stringify(body)),
      readLine: options.readLine,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    },
  })
  return { ctx, invocation: { ctx, args: { automationId: 'am_1' }, flags } }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('interactive confirmation command budget', () => {
  it('pauses an active prompt and resumes only the remaining budget', async () => {
    let answer: (value: string) => void = () => undefined
    const { ctx, invocation } = interactiveContext({
      input: JSON.stringify(body),
      readLine: () =>
        new Promise((resolve) => {
          answer = resolve
        }),
    })
    ctx.startDeadline()
    await vi.advanceTimersByTimeAsync(60)
    const pending = enforceConfirmation(automationsTestCommand, invocation)
    try {
      await vi.advanceTimersByTimeAsync(1000)
      expect(
        ctx.signal.aborted,
        'human approval time is outside the command budget'
      ).toBe(false)
      answer('yes')
      await pending
      await vi.advanceTimersByTimeAsync(39)
      expect(ctx.signal.aborted).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(ctx.signal.reason).toBeInstanceOf(CliTimeoutError)
    } finally {
      answer('yes')
      await pending
      ctx.stopDeadline()
    }
  })

  it('keeps an ordinary inline prompt unarmed until the command starts', async () => {
    let answer: (value: string) => void = () => undefined
    const { ctx, invocation } = interactiveContext({
      input: JSON.stringify(body),
      readLine: () =>
        new Promise((resolve) => {
          answer = resolve
        }),
    })
    const pending = enforceConfirmation(automationsTestCommand, invocation)
    try {
      await vi.advanceTimersByTimeAsync(1000)
      expect(ctx.signal.aborted).toBe(false)
      answer('yes')
      await pending
      await vi.advanceTimersByTimeAsync(1000)
      expect(ctx.signal.aborted).toBe(false)
      ctx.startDeadline()
      await vi.advanceTimersByTimeAsync(99)
      expect(ctx.signal.aborted).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(ctx.signal.reason).toBeInstanceOf(CliTimeoutError)
    } finally {
      answer('yes')
      await pending
      ctx.stopDeadline()
    }
  })

  it('preserves a caller interrupt during deferred approval', async () => {
    const caller = new AbortController()
    const reason = new CliInterruptError('SIGINT')
    const { ctx, invocation } = interactiveContext({
      input: '-',
      signal: caller.signal,
      readLine: () =>
        new Promise((_resolve, reject) => {
          caller.signal.addEventListener(
            'abort',
            () => reject(caller.signal.reason),
            { once: true }
          )
        }),
    })
    ctx.startDeadline()
    await vi.advanceTimersByTimeAsync(60)
    const pending = enforceStdinConfirmation(
      automationsTestCommand,
      invocation,
      body
    )
    const rejected = expect(pending).rejects.toBe(reason)
    caller.abort(reason)
    try {
      await rejected
      await vi.advanceTimersByTimeAsync(1000)
      expect(ctx.signal.reason).toBe(reason)
    } finally {
      ctx.stopDeadline()
    }
  })

  it('refuses an expired stdin budget before asking for approval', async () => {
    const readLine = vi.fn(async () => 'yes')
    const { ctx, invocation } = interactiveContext({ input: '-', readLine })
    ctx.startDeadline()
    await vi.advanceTimersByTimeAsync(100)
    try {
      await expect(
        enforceStdinConfirmation(automationsTestCommand, invocation, body)
      ).rejects.toBe(ctx.signal.reason)
      expect(readLine).not.toHaveBeenCalled()
    } finally {
      ctx.stopDeadline()
    }
  })

  it('refuses a fully spent budget even when its timer has not fired yet', async () => {
    const readLine = vi.fn(async () => 'yes')
    const { ctx, invocation } = interactiveContext({ input: '-', readLine })
    ctx.startDeadline()
    vi.spyOn(performance, 'now').mockReturnValue(100)
    try {
      await expect(
        enforceStdinConfirmation(automationsTestCommand, invocation, body)
      ).rejects.toBeInstanceOf(CliTimeoutError)
      expect(readLine).not.toHaveBeenCalled()
    } finally {
      ctx.stopDeadline()
    }
  })
})
