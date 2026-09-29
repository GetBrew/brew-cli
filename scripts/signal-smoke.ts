/**
 * Signal smoke test for the BUILT binary (`bun run build` first):
 *
 *   bun run scripts/signal-smoke.ts
 *
 * The in-process suite injects an abort signal; only a real process can
 * prove the rest of the contract: that SIGINT/SIGTERM stop a request that
 * is in flight, that the error envelope still reaches stderr, and that the
 * CLI then dies BY the signal (so a calling shell loop stops too).
 *
 * Runs against a loopback server that accepts the request and never answers.
 * No network, no real key.
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

type Outcome = {
  readonly exitCode: number | null
  readonly signal: NodeJS.Signals | null
  readonly stderr: string
  readonly ms: number
}

async function interruptMidRequest(
  signal: 'SIGINT' | 'SIGTERM'
): Promise<Outcome> {
  let onRequest: () => void = () => undefined
  const requested = new Promise<void>((resolve) => {
    onRequest = resolve
  })
  const server = createServer(() => {
    onRequest()
    // Hold the request open and never answer.
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address() as AddressInfo
  const child = spawn(
    process.execPath,
    [
      'dist/bin.js',
      'domains',
      'list',
      '--json',
      '--api-url',
      `http://127.0.0.1:${port}/api`,
    ],
    {
      env: {
        PATH: process.env.PATH ?? '',
        BREW_API_KEY: 'brew_smoke_test_not_a_real_key_0000',
        BREW_CLI_CONFIG_DIR: '/nonexistent-brew-cli-smoke',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )
  let stderr = ''
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
  })
  const exited = new Promise<{
    code: number | null
    sig: NodeJS.Signals | null
  }>((resolve) => {
    child.on('exit', (code, sig) => {
      resolve({ code, sig })
    })
  })
  await requested
  const started = performance.now()
  child.kill(signal)
  const timeout = new Promise<'timeout'>((resolve) => {
    setTimeout(() => {
      resolve('timeout')
    }, 5000)
  })
  const result = await Promise.race([exited, timeout])
  server.closeAllConnections()
  server.close()
  if (result === 'timeout') {
    child.kill('SIGKILL')
    throw new Error(`${signal}: the CLI did not exit within 5 s`)
  }
  return {
    exitCode: result.code,
    signal: result.sig,
    stderr,
    ms: Math.round(performance.now() - started),
  }
}

const failures: string[] = []
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  const outcome = await interruptMidRequest(signal)
  const line = outcome.stderr.trim().split('\n').at(-1) ?? ''
  let code: unknown
  try {
    code = (JSON.parse(line) as { error?: { code?: unknown } }).error?.code
  } catch {
    code = undefined
  }
  const ok =
    outcome.signal === signal && code === 'CLI_INTERRUPTED' && outcome.ms < 2000
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${signal}: died by ${String(outcome.signal)} (exit ${String(outcome.exitCode)}) in ${outcome.ms}ms; envelope code ${String(code)}`
  )
  if (!ok) {
    failures.push(`${signal}: ${outcome.stderr.trim()}`)
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}
