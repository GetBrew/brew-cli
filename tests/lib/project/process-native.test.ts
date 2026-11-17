import type { SpawnOptions } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultSpawn } from '../../../src/lib/project/process'

vi.mock('node:child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:child_process')>()
  return {
    ...original,
    spawn(command: string, args: readonly string[], options: SpawnOptions) {
      const child = original.spawn(command, [...args], options)
      if (args[1]?.includes('BREW_UNUSED_STDIN_REGRESSION')) {
        const marker = args[2] as string
        const deadline = Date.now() + 5_000
        // Simulate the parent being descheduled while the real child starts.
        while (!existsSync(marker)) {
          if (Date.now() >= deadline) {
            child.kill('SIGKILL')
            throw new Error('Child did not close its standard input in time')
          }
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5)
        }
      }
      return child
    },
  }
})

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('native process standard input', () => {
  it.skipIf(process.platform === 'win32')(
    'survives a child closing unused stdin before the parent resumes',
    async () => {
      const root = mkdtempSync(join(tmpdir(), 'brew-unused-stdin-'))
      roots.push(root)
      const result = await defaultSpawn(process.execPath, [
        '-e',
        "const fs = require('node:fs'); fs.closeSync(0); fs.writeFileSync(process.argv[1], 'BREW_UNUSED_STDIN_REGRESSION'); process.stdout.write('ready'); setTimeout(() => {}, 100)",
        join(root, 'closed'),
      ])
      expect(result).toEqual({ code: 0, stdout: 'ready', stderr: '' })
    }
  )

  it('delivers explicit input and closes it so the child can finish reading', async () => {
    const result = await defaultSpawn(
      process.execPath,
      [
        '-e',
        "let text = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => text += chunk); process.stdin.on('end', () => process.stdout.write(text.toUpperCase()))",
      ],
      { input: 'hello' }
    )
    expect(result).toEqual({ code: 0, stdout: 'HELLO', stderr: '' })
  })
})
