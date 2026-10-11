import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { readTextFile } from './fs-writer'

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
    const parsed: unknown = JSON.parse(text)
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
  let inPackages = false
  for (const raw of text.replaceAll('\r\n', '\n').split('\n')) {
    const line = raw.replace(/\s+#.*$/, '')
    if (/^packages\s*:/.test(line)) {
      inPackages = true
      const inline = /^packages\s*:\s*\[(.*)\]\s*$/.exec(line)
      if (inline !== null) {
        for (const item of (inline[1] ?? '').split(',')) {
          const value = unquote(item.trim())
          if (value !== '') {
            patterns.push(value)
          }
        }
        inPackages = false
      }
      continue
    }
    if (!inPackages) {
      continue
    }
    const item = /^\s*-\s*(.+?)\s*$/.exec(line)
    if (item !== null) {
      patterns.push(unquote(item[1] ?? ''))
    } else if (/^\S/.test(line)) {
      inPackages = false
    }
  }
  return patterns.filter((pattern) => pattern !== '')
}

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

function segmentRegex(segment: string): RegExp {
  const body = segment
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replaceAll('*', '[^/]*')
    .replaceAll('?', '[^/]')
  return new RegExp(`^${body}$`)
}

/** Directories (root-relative, POSIX) matched by one workspace glob. */
function expandGlob(root: string, pattern: string): string[] {
  const segments = pattern
    .replace(/^\.\//, '')
    .replace(/\/+$/, '')
    .split('/')
    .filter((segment) => segment !== '')
  const results: string[] = []
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
    if (!/[*?]/.test(segment)) {
      const next = dir === '' ? segment : `${dir}/${segment}`
      if (isDirectory(join(root, next))) {
        walk(next, index + 1, depth + 1)
      }
      return
    }
    const regex = segmentRegex(segment)
    for (const child of listDirs(absolute)) {
      if (regex.test(child)) {
        walk(dir === '' ? child : `${dir}/${child}`, index + 1, depth + 1)
      }
    }
  }
  walk('', 0, 0)
  return results
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
    for (const dir of expandGlob(root, negated ? pattern.slice(1) : pattern)) {
      target.add(dir)
    }
  }
  const packages: WorkspacePackage[] = []
  for (const dir of [...include].sort()) {
    if (dir === '' || exclude.has(dir)) {
      continue
    }
    const pkg = readJsonObject(join(root, dir, 'package.json'))
    if (pkg === null) {
      continue
    }
    const name =
      typeof pkg.name === 'string' && pkg.name !== ''
        ? pkg.name
        : (dir.split('/').at(-1) ?? dir)
    packages.push({ name, dir })
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
    const packages = listWorkspacePackages(dir, patterns)
    const workspace =
      relativeCwd === ''
        ? null
        : (packages
            .filter(
              (pkg) =>
                relativeCwd === pkg.dir || relativeCwd.startsWith(`${pkg.dir}/`)
            )
            .sort((a, b) => b.dir.length - a.dir.length)[0] ?? null)
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
