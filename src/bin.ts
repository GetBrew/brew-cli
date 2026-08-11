import { createInterface } from 'node:readline/promises'
import { run } from './cli'
import type { CliIo } from './lib/types'

function realIo(): CliIo {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
    isTtyOut: process.stdout.isTTY === true,
    isTtyIn: process.stdin.isTTY === true,
    env: process.env,
    readStdin: async () => {
      process.stdin.setEncoding('utf8')
      let data = ''
      for await (const chunk of process.stdin) {
        data += chunk
      }
      return data
    },
    readLine: async (prompt: string) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stderr,
      })
      try {
        return await rl.question(prompt)
      } finally {
        rl.close()
      }
    },
  }
}

process.exitCode = await run(process.argv.slice(2), realIo())
