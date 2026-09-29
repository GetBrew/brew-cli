import {
  CliInterruptError,
  exitCodeForSignal,
  type InterruptSignal,
} from './errors'

/**
 * SIGINT (Ctrl-C) and SIGTERM (an agent harness or CI stopping the process)
 * become a cancel, not a crash: the first signal aborts the command's
 * signal with a `CliInterruptError`, the request in flight stops where it
 * is, and the command exits 130/143 with an envelope naming what was
 * interrupted — including the key that replays an interrupted write.
 *
 * A second signal, or the first one not taking effect within `graceMs`,
 * exits at once: Ctrl-C must never be ignorable.
 */
export type Interrupter = {
  readonly signal: AbortSignal
  /** For inputs that swallow the process signal (a raw-mode prompt). */
  readonly trigger: (signal: InterruptSignal) => void
  /** The first signal received, if any. */
  readonly received: () => InterruptSignal | undefined
  /** Cancel the grace timer once the command has finished on its own. */
  readonly settle: () => void
}

export function createInterrupter(input: {
  readonly source: {
    on(event: InterruptSignal, listener: () => void): unknown
  }
  readonly stderr: NodeJS.WritableStream
  readonly exit: (code: number) => void
  readonly graceMs?: number
}): Interrupter {
  const controller = new AbortController()
  const graceMs = input.graceMs ?? 3000
  let first: InterruptSignal | undefined
  let grace: ReturnType<typeof setTimeout> | undefined

  const forceExit = (signal: InterruptSignal, why: string): void => {
    input.stderr.write(`\nbrew-cli: ${why}; exiting without waiting.\n`)
    input.exit(exitCodeForSignal(signal))
  }

  const trigger = (signal: InterruptSignal): void => {
    if (first !== undefined) {
      forceExit(signal, `${signal} received twice`)
      return
    }
    first = signal
    controller.abort(new CliInterruptError(signal))
    grace = setTimeout(() => {
      forceExit(signal, `still stopping ${graceMs / 1000}s after ${signal}`)
    }, graceMs)
    // The grace timer must never be what keeps a finished process alive.
    grace.unref?.()
  }

  input.source.on('SIGINT', () => {
    trigger('SIGINT')
  })
  input.source.on('SIGTERM', () => {
    trigger('SIGTERM')
  })

  return {
    signal: controller.signal,
    trigger,
    received: () => first,
    settle: () => {
      if (grace !== undefined) {
        clearTimeout(grace)
      }
    },
  }
}
