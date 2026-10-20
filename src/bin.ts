import { createInterface } from 'node:readline/promises'
import { run } from './cli'
import { exitCodeForSignal } from './lib/errors'
import { createInterrupter, type Interrupter } from './lib/interrupt'
import { readStdinText } from './lib/stdin'
import type { CliIo } from './lib/types'

function realIo(interrupter: Interrupter): CliIo {
  const { signal } = interrupter
  return {
    stdout: process.stdout,
    stderr: process.stderr,
    isTtyOut: process.stdout.isTTY === true,
    isTtyIn: process.stdin.isTTY === true,
    env: process.env,
    signal,
    readStdin: (readSignal = signal) =>
      readStdinText({ stream: process.stdin, signal: readSignal }),
    readLine: async (prompt: string) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stderr,
      })
      // A prompt sees Ctrl-C as its own SIGINT, not the process's.
      rl.on('SIGINT', () => {
        interrupter.trigger('SIGINT')
      })
      try {
        return await rl.question(prompt, { signal })
      } finally {
        rl.close()
      }
    },
  }
}

const interrupter = createInterrupter({
  source: process,
  stderr: process.stderr,
  exit: (code) => process.exit(code),
})
const code = await run(process.argv.slice(2), realIo(interrupter))
interrupter.settle()
process.exitCode = code

// Die BY the signal, not merely with 130/143: a shell loop such as
// `for id in …; do brew-cli …; done` only stops on Ctrl-C when the child
// was killed by SIGINT.
const received = interrupter.received()
if (
  received !== undefined &&
  code === exitCodeForSignal(received) &&
  process.platform !== 'win32'
) {
  // Pipes are asynchronous on macOS: let the envelope reach stderr first.
  await new Promise<void>((resolve) => {
    process.stderr.write('', () => {
      resolve()
    })
  })
  process.removeAllListeners(received)
  process.kill(process.pid, received)
}
