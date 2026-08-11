import { PassThrough } from 'node:stream'
import { run } from '../../src/cli'
import type { CommandSpec } from '../../src/lib/define-command'
import type { CliIo } from '../../src/lib/types'
import { ALL_COMMANDS } from '../../src/registry'

export type RunCliOptions = {
  /** Synthetic environment. Host env NEVER leaks into tests. */
  readonly env?: Readonly<Record<string, string | undefined>>
  /** Text available on stdin (for `-` inputs and piped login). */
  readonly stdin?: string
  /** Answer returned by interactive prompts (readLine). */
  readonly promptAnswer?: string
  readonly ttyOut?: boolean
  readonly ttyIn?: boolean
  /**
   * Extra command specs to mount alongside the registry — lets a command
   * be tested before it is wired into src/registry.ts.
   */
  readonly extraCommands?: readonly CommandSpec[]
}

export type RunCliResult = {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
  /** stdout parsed as JSON when possible (single-line JSON output). */
  readonly json: unknown
}

export async function runCli(
  argv: readonly string[],
  options: RunCliOptions = {}
): Promise<RunCliResult> {
  let stdout = ''
  let stderr = ''
  const out = new PassThrough()
  out.on('data', (chunk: Buffer) => {
    stdout += chunk.toString()
  })
  const err = new PassThrough()
  err.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
  })
  const io: CliIo = {
    stdout: out,
    stderr: err,
    isTtyOut: options.ttyOut ?? false,
    isTtyIn: options.ttyIn ?? false,
    env: options.env ?? {},
    readStdin: async () => options.stdin ?? '',
    readLine: async () => options.promptAnswer ?? '',
  }
  const code = await run(
    argv,
    io,
    options.extraCommands === undefined
      ? undefined
      : [...ALL_COMMANDS, ...options.extraCommands]
  )
  return { code, stdout, stderr, json: tryParse(stdout) }
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {}
}
