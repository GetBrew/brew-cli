import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { shellQuote } from '../confirm'
import { readTextFile } from './fs-writer'

/**
 * Which package manager a project uses, and the exact command lines to add
 * a dependency, install, or run a binary with it — workspace-aware, so a
 * monorepo app gets `pnpm add x --filter web`, not a root install.
 *
 * Evidence, strongest first: `package.json#packageManager` (Corepack's
 * pin), then lockfiles, then the `npm_config_user_agent` of the process
 * that launched us (`pnpm dlx …`, `bunx …`), then npm.
 */

export type PackageManagerName = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'deno'

export type PackageManager = {
  readonly name: PackageManagerName
  /** From `packageManager` or the user agent, when known. */
  readonly version?: string
  /** Yarn only: v1 (`classic`) or v2+ (`berry`). */
  readonly yarnFlavor?: 'classic' | 'berry'
  /** Yarn berry with Plug'n'Play: no node_modules directory. */
  readonly pnp?: boolean
  readonly source: 'packageManager' | 'lockfile' | 'user-agent' | 'default'
  /** The lockfile that decided it (relative to its directory). */
  readonly lockfile?: string
  /** Every lockfile found, when more than one manager's are present. */
  readonly conflictingLockfiles?: readonly string[]
}

const LOCKFILES: ReadonlyArray<{
  readonly file: string
  readonly name: PackageManagerName
}> = [
  { file: 'bun.lock', name: 'bun' },
  { file: 'bun.lockb', name: 'bun' },
  { file: 'pnpm-lock.yaml', name: 'pnpm' },
  { file: 'yarn.lock', name: 'yarn' },
  { file: 'package-lock.json', name: 'npm' },
  { file: 'npm-shrinkwrap.json', name: 'npm' },
  { file: 'deno.lock', name: 'deno' },
]

const NAMES: readonly PackageManagerName[] = [
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'deno',
]

function isName(value: string): value is PackageManagerName {
  return (NAMES as readonly string[]).includes(value)
}

function readPackageJson(dir: string): Record<string, unknown> | null {
  const text = readTextFile(join(dir, 'package.json'))
  if (text === null) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** `pnpm@9.1.0+sha512.…` → `{ name: 'pnpm', version: '9.1.0' }`. */
export function parsePackageManagerField(
  value: unknown
): { readonly name: PackageManagerName; readonly version: string } | null {
  if (typeof value !== 'string') {
    return null
  }
  const match = /^([a-z]+)@(\d[^+\s]*)/.exec(value.trim())
  const name = match?.[1]
  const version = match?.[2]
  if (name === undefined || version === undefined || !isName(name)) {
    return null
  }
  return { name, version }
}

/** `pnpm/9.1.0 npm/? node/v20.11.0 darwin arm64` → pnpm 9.1.0. */
export function parseUserAgent(
  value: string | undefined
): { readonly name: PackageManagerName; readonly version: string } | null {
  const match = /^([a-z]+)\/(\S+)/.exec(value ?? '')
  const name = match?.[1]
  const version = match?.[2]
  if (name === undefined || version === undefined || !isName(name)) {
    return null
  }
  return { name, version }
}

function majorOf(version: string | undefined): number | undefined {
  const major = Number.parseInt(version ?? '', 10)
  return Number.isNaN(major) ? undefined : major
}

/** `nodeLinker` from `.yarnrc.yml` (berry), or undefined when unset. */
function readNodeLinker(dir: string): string | undefined {
  const text = readTextFile(join(dir, '.yarnrc.yml'))
  if (text === null) {
    return undefined
  }
  const match = /^\s*nodeLinker\s*:\s*["']?([\w-]+)["']?\s*$/m.exec(text)
  return match?.[1]
}

function yarnDetails(
  dir: string,
  version: string | undefined
): Pick<PackageManager, 'yarnFlavor' | 'pnp'> {
  const major = majorOf(version)
  const lock = readTextFile(join(dir, 'yarn.lock'))
  const hasYarnrcYml = existsSync(join(dir, '.yarnrc.yml'))
  const isBerry =
    major !== undefined
      ? major >= 2
      : hasYarnrcYml || lock?.includes('__metadata:') === true
  if (!isBerry) {
    return { yarnFlavor: 'classic', pnp: false }
  }
  const linker = readNodeLinker(dir)
  // Berry's default linker is Plug'n'Play.
  const pnp =
    linker === undefined
      ? !existsSync(join(dir, 'node_modules')) ||
        existsSync(join(dir, '.pnp.cjs'))
      : linker === 'pnp'
  return { yarnFlavor: 'berry', pnp }
}

function describe(
  dir: string,
  name: PackageManagerName,
  rest: Omit<PackageManager, 'name' | 'yarnFlavor' | 'pnp'>
): PackageManager {
  return {
    name,
    ...rest,
    ...(name === 'yarn' ? yarnDetails(dir, rest.version) : {}),
  }
}

/**
 * The package manager for a project. `dirs` is where to look, nearest
 * first: an app directory, then its monorepo root (lockfiles live at the
 * root). `env` supplies `npm_config_user_agent`.
 */
export function detectPackageManager(
  dirs: readonly string[],
  env: Readonly<Record<string, string | undefined>> = {}
): PackageManager {
  for (const dir of dirs) {
    const pinned = parsePackageManagerField(
      readPackageJson(dir)?.packageManager
    )
    if (pinned !== null) {
      return describe(dir, pinned.name, {
        version: pinned.version,
        source: 'packageManager',
      })
    }
  }
  for (const dir of dirs) {
    const found = LOCKFILES.filter((entry) => existsSync(join(dir, entry.file)))
    const first = found[0]
    if (first !== undefined) {
      const managers = new Set(found.map((entry) => entry.name))
      return describe(dir, first.name, {
        source: 'lockfile',
        lockfile: first.file,
        ...(managers.size > 1
          ? { conflictingLockfiles: found.map((entry) => entry.file) }
          : {}),
      })
    }
    const isDenoOnly =
      !existsSync(join(dir, 'package.json')) &&
      (existsSync(join(dir, 'deno.json')) ||
        existsSync(join(dir, 'deno.jsonc')))
    if (isDenoOnly) {
      return { name: 'deno', source: 'lockfile', lockfile: 'deno.json' }
    }
  }
  const agent = parseUserAgent(env.npm_config_user_agent)
  if (agent !== null) {
    return describe(dirs[0] ?? '.', agent.name, {
      version: agent.version,
      source: 'user-agent',
    })
  }
  return { name: 'npm', source: 'default' }
}

/** A command line to run, from the project root (or `cwd` below it). */
export type CommandLine = {
  readonly command: string
  readonly args: readonly string[]
  /** Run from this root-relative directory instead of the root. */
  readonly cwd?: string
}

/** The workspace a command targets inside a monorepo. */
export type WorkspaceTarget = {
  /** `package.json#name` of the workspace package. */
  readonly name: string
  /** Its directory, relative to the monorepo root (POSIX). */
  readonly dir: string
}

export function formatCommandLine(line: CommandLine): string {
  const text = [line.command, ...line.args].map(shellQuote).join(' ')
  return line.cwd === undefined || line.cwd === '.' || line.cwd === ''
    ? text
    : `cd ${shellQuote(line.cwd)} && ${text}`
}

export type AddOptions = {
  readonly dev?: boolean
  /** Add to this workspace package (monorepo), not the root. */
  readonly workspace?: WorkspaceTarget
  /** Pin the exact version instead of a range. */
  readonly exact?: boolean
}

/** `pnpm add @brew.new/sdk --filter web`, `npm install -D x -w web`, … */
export function addCommand(
  pm: PackageManager,
  packages: readonly string[],
  options: AddOptions = {}
): CommandLine {
  const dev = options.dev === true
  const exact = options.exact === true
  const ws = options.workspace
  switch (pm.name) {
    case 'npm':
      return {
        command: 'npm',
        args: [
          'install',
          ...(dev ? ['--save-dev'] : []),
          ...(exact ? ['--save-exact'] : []),
          ...(ws === undefined ? [] : ['--workspace', ws.name]),
          ...packages,
        ],
      }
    case 'pnpm':
      return {
        command: 'pnpm',
        args: [
          'add',
          ...(dev ? ['--save-dev'] : []),
          ...(exact ? ['--save-exact'] : []),
          ...(ws === undefined ? [] : ['--filter', ws.name]),
          ...packages,
        ],
      }
    case 'yarn':
      return {
        command: 'yarn',
        args: [
          ...(ws === undefined ? [] : ['workspace', ws.name]),
          'add',
          ...(dev ? ['--dev'] : []),
          ...(exact ? ['--exact'] : []),
          ...packages,
        ],
      }
    case 'bun':
      // `bun add` has no workspace filter: run it inside the package.
      return {
        command: 'bun',
        args: [
          'add',
          ...(dev ? ['--dev'] : []),
          ...(exact ? ['--exact'] : []),
          ...packages,
        ],
        ...(ws === undefined ? {} : { cwd: ws.dir }),
      }
    case 'deno':
      return {
        command: 'deno',
        args: [
          'add',
          ...(dev ? ['--dev'] : []),
          ...packages.map((spec) =>
            spec.startsWith('npm:') || spec.startsWith('jsr:')
              ? spec
              : `npm:${spec}`
          ),
        ],
        ...(ws === undefined ? {} : { cwd: ws.dir }),
      }
  }
}

/** Install every dependency (the lockfile's, when `frozen`). */
export function installCommand(
  pm: PackageManager,
  options: { readonly frozen?: boolean } = {}
): CommandLine {
  const frozen = options.frozen === true
  switch (pm.name) {
    case 'npm':
      return { command: 'npm', args: frozen ? ['ci'] : ['install'] }
    case 'pnpm':
      return {
        command: 'pnpm',
        args: ['install', ...(frozen ? ['--frozen-lockfile'] : [])],
      }
    case 'yarn':
      return {
        command: 'yarn',
        args: [
          'install',
          ...(frozen
            ? [pm.yarnFlavor === 'berry' ? '--immutable' : '--frozen-lockfile']
            : []),
        ],
      }
    case 'bun':
      return {
        command: 'bun',
        args: ['install', ...(frozen ? ['--frozen-lockfile'] : [])],
      }
    case 'deno':
      return {
        command: 'deno',
        args: ['install', ...(frozen ? ['--frozen'] : [])],
      }
  }
}

/** Run a binary from the project's own dependencies. */
export function execCommand(
  pm: PackageManager,
  bin: string,
  args: readonly string[] = [],
  options: { readonly workspace?: WorkspaceTarget } = {}
): CommandLine {
  const ws = options.workspace
  switch (pm.name) {
    case 'npm':
      return {
        command: 'npm',
        args: [
          'exec',
          ...(ws === undefined ? [] : ['--workspace', ws.name]),
          '--',
          bin,
          ...args,
        ],
      }
    case 'pnpm':
      return {
        command: 'pnpm',
        args: [
          ...(ws === undefined ? [] : ['--filter', ws.name]),
          'exec',
          bin,
          ...args,
        ],
      }
    case 'yarn':
      if (pm.yarnFlavor === 'berry') {
        return {
          command: 'yarn',
          args: [
            ...(ws === undefined ? [] : ['workspace', ws.name]),
            'exec',
            bin,
            ...args,
          ],
        }
      }
      // Classic has no `exec`: `yarn <bin>` runs a dependency's binary.
      return {
        command: 'yarn',
        args: [
          ...(ws === undefined ? [] : ['workspace', ws.name]),
          bin,
          ...args,
        ],
      }
    case 'bun':
      return {
        command: 'bun',
        args: ['x', bin, ...args],
        ...(ws === undefined ? {} : { cwd: ws.dir }),
      }
    case 'deno':
      return {
        command: 'deno',
        args: ['run', '-A', `npm:${bin}`, ...args],
        ...(ws === undefined ? {} : { cwd: ws.dir }),
      }
  }
}

/** Download and run a package once (`npx -y`, `pnpm dlx`, `bunx`). */
export function dlxCommand(
  pm: PackageManager,
  spec: string,
  args: readonly string[] = []
): CommandLine {
  switch (pm.name) {
    case 'pnpm':
      return { command: 'pnpm', args: ['dlx', spec, ...args] }
    case 'yarn':
      return pm.yarnFlavor === 'berry'
        ? { command: 'yarn', args: ['dlx', spec, ...args] }
        : { command: 'npx', args: ['-y', spec, ...args] }
    case 'bun':
      return { command: 'bunx', args: [spec, ...args] }
    case 'deno':
      return { command: 'deno', args: ['run', '-A', `npm:${spec}`, ...args] }
    case 'npm':
      return { command: 'npx', args: ['-y', spec, ...args] }
  }
}
