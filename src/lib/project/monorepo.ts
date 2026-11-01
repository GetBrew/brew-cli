import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { SpawnFn } from '../types'
import { readTextFile, stripBom } from './fs-writer'

/**
 * Where a project command should act: the app the user is standing in,
 * the monorepo around it (pnpm / npm / yarn / bun workspaces, Turborepo,
 * Nx), and every workspace package that looks like an app (it depends on a
 * web framework or server library) for a caller to choose from.
 */

export type MonorepoTool = 'turbo' | 'nx' | 'pnpm' | 'workspaces'

export type WorkspacePackage = {
  /** `package.json#name`, or the directory name when unnamed. */
  readonly name: string
  /** Relative to the monorepo root, POSIX separators. */
  readonly dir: string
}

export type AppCandidate = WorkspacePackage & {
  /** The framework its dependencies name (`next`, `vite`, `express`, …). */
  readonly framework: string
}

export type MonorepoInfo = {
  /** The orchestrator when there is one (turbo, nx), else the workspace source. */
  readonly tool: MonorepoTool
  readonly root: string
  /** The workspace package containing the cwd; `null` at the root. */
  readonly workspace: WorkspacePackage | null
  /** The workspace globs (`apps/*`, `packages/*`). */
  readonly patterns: readonly string[]
}

export type ResolvedProject = {
  /** The directory to act on: the cwd's package (or the cwd without one). */
  readonly root: string
  readonly monorepo: MonorepoInfo | null
  /**
   * App packages: in a monorepo, every workspace that depends on a
   * framework; otherwise the root package when it does.
   */
  readonly candidates: readonly AppCandidate[]
}

/**
 * Dependency → framework id, checked in order (a Next app that also lists
 * `react` is `next`). Server libraries count: an Express API sends email
 * too.
 */
export const FRAMEWORK_DEPENDENCIES: ReadonlyArray<
  readonly [dependency: string, framework: string]
> = [
  ['next', 'next'],
  ['@remix-run/react', 'remix'],
  ['@react-router/dev', 'react-router'],
  ['@tanstack/react-start', 'tanstack-start'],
  ['@sveltejs/kit', 'sveltekit'],
  ['nuxt', 'nuxt'],
  ['astro', 'astro'],
  ['@angular/core', 'angular'],
  ['@solidjs/start', 'solid-start'],
  ['expo', 'expo'],
  ['@nestjs/core', 'nestjs'],
  ['hono', 'hono'],
  ['fastify', 'fastify'],
  ['express', 'express'],
  ['koa', 'koa'],
  ['vite', 'vite'],
  ['react-scripts', 'create-react-app'],
]

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next'])
const MAX_GLOB_DEPTH = 6

export function readJsonObject(path: string): Record<string, unknown> | null {
  const text = readTextFile(path)
  if (text === null) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(stripBom(text))
    return typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** The framework a package.json depends on, or `null`. */
export function detectFramework(
  pkg: Record<string, unknown> | null
): string | null {
  if (pkg === null) {
    return null
  }
  const deps = new Set<string>()
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const record = pkg[field]
    if (typeof record === 'object' && record !== null) {
      for (const name of Object.keys(record)) {
        deps.add(name)
      }
    }
  }
  for (const [dependency, framework] of FRAMEWORK_DEPENDENCIES) {
    if (deps.has(dependency)) {
      return framework
    }
  }
  return null
}

/** The `packages:` list of a pnpm-workspace.yaml (the only key we need). */
export function parsePnpmWorkspaceYaml(text: string): string[] {
  const patterns: string[] = []
  let list: 'block' | 'inline' | null = null
  for (const raw of stripBom(text).replaceAll('\r\n', '\n').split('\n')) {
    if (/^\s*#/.test(raw)) {
      // A whole-line comment, at any column, never ends the list.
      continue
    }
    let line = raw.replace(/\s+#.*$/, '')
    const key = /^packages\s*:\s*(\[?)/.exec(line)
    if (key !== null) {
      list = key[1] === '[' ? 'inline' : 'block'
      line = line.slice(key[0].length)
    }
    if (list === 'inline') {
      // `[a, 'b,c', "d"]`, over one line or several: a quoted item keeps
      // its commas.
      for (const [item, single, double] of line.matchAll(INLINE_ITEM)) {
        if (item === ']') {
          list = null
          break
        }
        patterns.push(single ?? double ?? item)
      }
      continue
    }
    if (list === null || key !== null) {
      continue
    }
    const item = /^\s*-\s*(.+?)\s*$/.exec(line)
    if (item !== null) {
      patterns.push(unquote(item[1] ?? ''))
    } else if (/^\S/.test(line)) {
      list = null
    }
  }
  return patterns.filter((pattern) => pattern !== '')
}

const INLINE_ITEM = /'([^']*)'|"([^"]*)"|[^\s,'"\]]+|\]/g

function unquote(value: string): string {
  return value.replace(/^(['"])(.*)\1$/, '$2')
}

function workspacePatterns(dir: string): {
  readonly source: 'pnpm' | 'workspaces'
  readonly patterns: string[]
} | null {
  const pnpm = readTextFile(join(dir, 'pnpm-workspace.yaml'))
  if (pnpm !== null) {
    return { source: 'pnpm', patterns: parsePnpmWorkspaceYaml(pnpm) }
  }
  const pkg = readJsonObject(join(dir, 'package.json'))
  const field = pkg?.workspaces
  const list = Array.isArray(field)
    ? field
    : typeof field === 'object' && field !== null
      ? (field as { packages?: unknown }).packages
      : undefined
  if (Array.isArray(list)) {
    return {
      source: 'workspaces',
      patterns: list.filter((item): item is string => typeof item === 'string'),
    }
  }
  return null
}

/** A root turbo.json; a package-level one `extends` the root's (`["//"]`). */
function hasRootTurboJson(dir: string): boolean {
  const turbo = readJsonObject(join(dir, 'turbo.json'))
  return turbo !== null && turbo.extends === undefined
}

function hasMarker(dir: string): boolean {
  return (
    existsSync(join(dir, 'pnpm-workspace.yaml')) ||
    hasRootTurboJson(dir) ||
    existsSync(join(dir, 'nx.json')) ||
    workspacePatterns(dir) !== null
  )
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** One path segment of a glob: `*`, `?` and `[ab]` / `[!a-c]` classes. */
function segmentRegex(segment: string): RegExp {
  const body = segment.replace(
    /\[([!^]?)([^\]]+)\]|[*?]|[.+^${}()|[\]\\]/g,
    (match, negate: string | undefined, set: string | undefined) =>
      set !== undefined
        ? `[${negate === '' ? '' : '^'}${set.replaceAll('\\', '\\\\')}]`
        : match === '*'
          ? '[^/]*'
          : match === '?'
            ? '[^/]'
            : `\\${match}`
  )
  try {
    return new RegExp(`^${body}$`)
  } catch {
    // An invalid class (`[z-a]`) matches nothing, as in the glob libraries.
    return /$^/
  }
}

/** Directories (root-relative, POSIX) matched by one workspace glob. */
function expandGlob(root: string, pattern: string): string[] {
  const segments = pattern
    .replace(/^\.\//, '')
    .replace(/\/+$/, '')
    .split('/')
    .filter((segment) => segment !== '')
  const results: string[] = []
  // `depth` counts only folders a `**` descends into: the pattern's other
  // segments bound themselves, so a workspace named exactly is never lost.
  const walk = (dir: string, index: number, depth: number): void => {
    if (depth > MAX_GLOB_DEPTH) {
      return
    }
    if (index === segments.length) {
      results.push(dir)
      return
    }
    const segment = segments[index] ?? ''
    const absolute = join(root, dir)
    if (segment === '**') {
      walk(dir, index + 1, depth)
      for (const child of listDirs(absolute)) {
        walk(dir === '' ? child : `${dir}/${child}`, index, depth + 1)
      }
      return
    }
    if (!/[*?[]/.test(segment)) {
      const next = dir === '' ? segment : `${dir}/${segment}`
      if (isDirectory(join(root, next))) {
        walk(next, index + 1, depth)
      }
      return
    }
    const regex = segmentRegex(segment)
    for (const child of listDirs(absolute)) {
      if (regex.test(child)) {
        walk(dir === '' ? child : `${dir}/${child}`, index + 1, depth)
      }
    }
  }
  walk('', 0, 0)
  return results
}

/** Whether a root-relative dir matches one workspace glob (`**` spans any depth). */
function matchesGlob(dir: string, glob: string): boolean {
  const segments = glob
    .replace(/^\.\//, '')
    .replace(/\/+$/, '')
    .split('/')
    .filter((segment) => segment !== '')
  const parts = dir.split('/')
  const match = (i: number, j: number): boolean => {
    const segment = segments[i]
    if (segment === undefined) {
      return j === parts.length
    }
    if (segment === '**') {
      for (let k = j; k <= parts.length; k += 1) {
        if (k > j && SKIP_DIRS.has(parts[k - 1] ?? '')) {
          return false
        }
        if (match(i + 1, k)) {
          return true
        }
      }
      return false
    }
    const part = parts[j]
    if (part === undefined) {
      return false
    }
    if (!/[*?[]/.test(segment)) {
      return part === segment && match(i + 1, j + 1)
    }
    return (
      !SKIP_DIRS.has(part) &&
      segmentRegex(segment).test(part) &&
      match(i + 1, j + 1)
    )
  }
  return match(0, 0)
}

/** A workspace package at `dir`, or null when it holds no package.json. */
function workspacePackage(root: string, dir: string): WorkspacePackage | null {
  const pkg = readJsonObject(join(root, dir, 'package.json'))
  if (pkg === null) {
    return null
  }
  const name =
    typeof pkg.name === 'string' && pkg.name !== ''
      ? pkg.name
      : (dir.split('/').at(-1) ?? dir)
  return { name, dir }
}

/**
 * The workspace package holding `relativeCwd`: its deepest folder with a
 * package.json that the globs include and no negation excludes. Matched
 * directly, so no search depth can lose the package the cwd is in.
 */
function workspaceOf(
  root: string,
  relativeCwd: string,
  patterns: readonly string[]
): WorkspacePackage | null {
  const include: string[] = []
  const exclude: string[] = []
  for (const pattern of patterns) {
    const negated = pattern.startsWith('!')
    ;(negated ? exclude : include).push(
      ...expandBraces(negated ? pattern.slice(1) : pattern)
    )
  }
  const parts = relativeCwd.split('/')
  for (let length = parts.length; length > 0; length -= 1) {
    const dir = parts.slice(0, length).join('/')
    if (
      include.some((glob) => matchesGlob(dir, glob)) &&
      !exclude.some((glob) => matchesGlob(dir, glob))
    ) {
      const pkg = workspacePackage(root, dir)
      if (pkg !== null) {
        return pkg
      }
    }
  }
  return null
}

function listDirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !SKIP_DIRS.has(entry.name))
      .map((entry) => entry.name)
      .sort()
  } catch {
    return []
  }
}

/**
 * `{apps,packages}/*` → `apps/*`, `packages/*` (nested and repeated braces
 * included), as the glob libraries behind every workspace tool expand them.
 */
export function expandBraces(pattern: string): string[] {
  const open = pattern.indexOf('{')
  if (open === -1) {
    return [pattern]
  }
  let depth = 0
  const commas: number[] = []
  let close = -1
  for (let index = open; index < pattern.length; index += 1) {
    const char = pattern[index]
    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        close = index
        break
      }
    } else if (char === ',' && depth === 1) {
      commas.push(index)
    }
  }
  if (close === -1 || commas.length === 0) {
    // Unbalanced or a single alternative: a literal brace.
    const rest = close === -1 ? '' : pattern.slice(open + 1)
    return close === -1
      ? [pattern]
      : expandBraces(rest).map((tail) => `${pattern.slice(0, open + 1)}${tail}`)
  }
  const head = pattern.slice(0, open)
  const tail = pattern.slice(close + 1)
  const bounds = [open, ...commas, close]
  const alternatives: string[] = []
  for (let index = 0; index < bounds.length - 1; index += 1) {
    alternatives.push(
      pattern.slice((bounds[index] ?? 0) + 1, bounds[index + 1] ?? 0)
    )
  }
  return alternatives.flatMap((alternative) =>
    expandBraces(`${head}${alternative}${tail}`)
  )
}

/** Workspace packages under a monorepo root (dirs that hold a package.json). */
export function listWorkspacePackages(
  root: string,
  patterns: readonly string[]
): WorkspacePackage[] {
  const include = new Set<string>()
  const exclude = new Set<string>()
  for (const pattern of patterns) {
    const negated = pattern.startsWith('!')
    const target = negated ? exclude : include
    for (const glob of expandBraces(negated ? pattern.slice(1) : pattern)) {
      for (const dir of expandGlob(root, glob)) {
        target.add(dir)
      }
    }
  }
  const packages: WorkspacePackage[] = []
  for (const dir of [...include].sort()) {
    if (dir === '' || exclude.has(dir)) {
      continue
    }
    const pkg = workspacePackage(root, dir)
    if (pkg !== null) {
      packages.push(pkg)
    }
  }
  return packages
}

/** Walk up from `start`, stopping after the directory that holds `.git`. */
function* ancestors(start: string): Generator<string> {
  let current = resolve(start)
  for (;;) {
    yield current
    if (existsSync(join(current, '.git'))) {
      return
    }
    const parent = dirname(current)
    if (parent === current) {
      return
    }
    current = parent
  }
}

function toPosix(path: string): string {
  return path.split(sep).join('/')
}

/** The monorepo `cwd` sits in, if any. */
export function findMonorepo(cwd: string): MonorepoInfo | null {
  for (const dir of ancestors(cwd)) {
    if (!hasMarker(dir)) {
      continue
    }
    const workspaces = workspacePatterns(dir)
    const tool: MonorepoTool = hasRootTurboJson(dir)
      ? 'turbo'
      : existsSync(join(dir, 'nx.json'))
        ? 'nx'
        : (workspaces?.source ?? 'workspaces')
    const patterns =
      workspaces !== null && workspaces.patterns.length > 0
        ? workspaces.patterns
        : ['apps/*', 'packages/*', 'libs/*']
    const relativeCwd = toPosix(relative(dir, resolve(cwd)))
    const workspace =
      relativeCwd === '' ? null : workspaceOf(dir, relativeCwd, patterns)
    return { tool, root: dir, workspace, patterns }
  }
  return null
}

/**
 * The project to act on from `cwd`:
 * - in a monorepo workspace package → that package, candidates = every app
 *   workspace;
 * - at a monorepo root → the root, candidates = every app workspace (more
 *   than one is the caller's ambiguity to resolve);
 * - otherwise the nearest directory with a package.json (or `cwd` itself
 *   when there is none), candidates = that package when it is an app.
 */
export function resolveProjectRoot(cwd: string): ResolvedProject {
  const monorepo = findMonorepo(cwd)
  if (monorepo !== null) {
    const candidates: AppCandidate[] = []
    for (const pkg of listWorkspacePackages(monorepo.root, monorepo.patterns)) {
      const framework = detectFramework(
        readJsonObject(join(monorepo.root, pkg.dir, 'package.json'))
      )
      if (framework !== null) {
        candidates.push({ ...pkg, framework })
      }
    }
    return {
      root:
        monorepo.workspace === null
          ? monorepo.root
          : join(monorepo.root, monorepo.workspace.dir),
      monorepo,
      candidates,
    }
  }
  for (const dir of ancestors(cwd)) {
    const pkg = readJsonObject(join(dir, 'package.json'))
    if (pkg === null) {
      continue
    }
    const framework = detectFramework(pkg)
    return {
      root: dir,
      monorepo: null,
      candidates:
        framework === null
          ? []
          : [
              {
                name: typeof pkg.name === 'string' ? pkg.name : '.',
                dir: '.',
                framework,
              },
            ],
    }
  }
  return { root: resolve(cwd), monorepo: null, candidates: [] }
}

/**
 * The repository `cwd` is in, from `git rev-parse --show-toplevel` (through
 * the injectable spawn seam). `null` when git is missing, `cwd` is not in a
 * repository, or git names a directory that does not contain `cwd`.
 */
export async function findGitRoot(
  cwd: string,
  spawn: SpawnFn,
  signal?: AbortSignal
): Promise<string | null> {
  let stdout: string
  try {
    const result = await spawn('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      ...(signal === undefined ? {} : { signal }),
    })
    if (result.code !== 0) {
      return null
    }
    stdout = result.stdout
  } catch {
    signal?.throwIfAborted()
    return null
  }
  const top = stdout.trim()
  if (top === '' || top.includes('\n')) {
    return null
  }
  const root = resolve(top)
  const rel = relative(realPathOr(root), realPathOr(resolve(cwd)))
  return rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)
    ? null
    : root
}

function realPathOr(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

/**
 * `resolveProjectRoot`, except that with no package.json up to the
 * repository (and no monorepo) the project is the git repository root
 * (`git rev-parse --show-toplevel`), not the cwd: running from `docs/`
 * still acts on the repo.
 */
export async function resolveProjectRootWithGit(
  cwd: string,
  spawn: SpawnFn,
  signal?: AbortSignal
): Promise<ResolvedProject> {
  const resolved = resolveProjectRoot(cwd)
  if (
    resolved.monorepo !== null ||
    readJsonObject(join(resolved.root, 'package.json')) !== null
  ) {
    return resolved
  }
  const gitRoot = await findGitRoot(cwd, spawn, signal)
  return gitRoot === null ? resolved : { ...resolved, root: gitRoot }
}
