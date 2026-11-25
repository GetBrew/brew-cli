import {
  CliInterruptError,
  exitCodeForSignal,
  type InterruptSignal,
} from './errors'

export type Interrupter = {
  readonly signal: AbortSignal
  readonly trigger: (signal: InterruptSignal) => void
  readonly received: () => InterruptSignal | undefined
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
