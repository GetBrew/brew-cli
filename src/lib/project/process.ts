import { spawn as nodeSpawn } from 'node:child_process'
import { homedir } from 'node:os'
import type { CliIo, SpawnFn, SpawnResult } from '../types'

/**
 * The real implementations behind the optional `CliIo` seams. Project
 * commands read the seam first, so tests inject a fake `spawn`, a recording
 * `openUrl` and a temp `cwd` and never touch the host.
 */

/** The working directory a project command acts on. */
export function resolveCwd(io: Pick<CliIo, 'cwd'>): string {
  return io.cwd ?? process.cwd()
}

export function resolveSpawn(io: Pick<CliIo, 'spawn'>): SpawnFn {
  return io.spawn ?? defaultSpawn
}

/**
 * The user's home directory, read from the (injected) environment first so
 * tests can point user-scope writes at a temp dir.
 */
export function resolveHomeDir(
  env: Readonly<Record<string, string | undefined>>
): string {
  const fromEnv = env.HOME ?? env.USERPROFILE
  return fromEnv !== undefined && fromEnv !== '' ? fromEnv : homedir()
}

const MAX_CAPTURE_BYTES = 1_000_000

/**
 * The line cmd.exe runs for `command args`, every argument quoted so cmd
 * passes `^`, `&` and spaces through. cmd still expands `%` and cannot nest
 * `"` inside quotes, so such arguments are refused instead of changed.
 */
export function windowsCommandLine(
  command: string,
  args: readonly string[]
): string {
  return [command, ...args]
    .map((arg) => {
      if (/["%\r\n]/.test(arg)) {
        throw new Error(`cmd.exe cannot pass ${JSON.stringify(arg)} as is.`)
      }
      // A trailing backslash would escape the closing quote.
      return `"${arg.replace(/\\+$/, '$&$&')}"`
    })
    .join(' ')
}

/**
 * `child_process.spawn`, stdout/stderr captured (bounded). No shell, except
 * on Windows, where npm, pnpm and yarn are `.cmd` files only cmd.exe starts.
 */
export const defaultSpawn: SpawnFn = (command, args, options = {}) =>
  new Promise<SpawnResult>((resolve, reject) => {
    const windows = process.platform === 'win32'
    const child = nodeSpawn(
      windows ? windowsCommandLine(command, args) : command,
      windows ? [] : [...args],
      {
        cwd: options.cwd,
        shell: windows,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      }
    )
    let stdout = ''
    let stderr = ''
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      if (stdout.length < MAX_CAPTURE_BYTES) {
        stdout += chunk
      }
    })
    child.stderr?.on('data', (chunk: string) => {
      if (stderr.length < MAX_CAPTURE_BYTES) {
        stderr += chunk
      }
    })
    child.on('error', reject)
    child.on('close', (code) => {
      resolve({ code, stdout, stderr })
    })
    child.stdin?.end(options.input ?? '')
  })

/**
 * Hands a URL to the platform opener. Only absolute URLs with a scheme are
 * accepted, and the URL is one argv entry (never shell-interpreted).
 */
export async function defaultOpenUrl(
  url: string,
  spawn: SpawnFn = defaultSpawn
): Promise<void> {
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    throw new Error('Refusing to open a URL without a scheme.')
  }
  const [command, args]: readonly [string, readonly string[]] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
        : ['xdg-open', [url]]
  await spawn(command, args)
}
