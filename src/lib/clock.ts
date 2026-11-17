/**
 * Wall-clock time and waiting, behind a seam so a test can run a ten-minute
 * browser sign-in in milliseconds (`CliIo.clock`).
 */
export type Clock = {
  readonly now: () => number
  /**
   * Resolves after `ms`; rejects with `signal.reason` the moment `signal`
   * aborts (Ctrl-C, SIGTERM, the command's `--timeout`).
   */
  readonly sleep: (ms: number, signal: AbortSignal) => Promise<void>
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms, signal) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason)
        return
      }
      const onAbort = (): void => {
        clearTimeout(timer)
        reject(signal.reason)
      }
      const timer = setTimeout(
        () => {
          signal.removeEventListener('abort', onAbort)
          resolve()
        },
        Math.max(0, ms)
      )
      signal.addEventListener('abort', onAbort, { once: true })
    }),
}
