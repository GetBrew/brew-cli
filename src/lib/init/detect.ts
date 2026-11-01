import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, join, relative, resolve, sep } from 'node:path'
import { detectRemoteEnv } from '../auth-flow/remote-env'
import { detectMcpClients, type McpClientId } from '../mcp-clients'
import { readTextFile } from '../project/fs-writer'
import {
  type AppCandidate,
  type MonorepoInfo,
  readJsonObject,
  resolveProjectRoot,
} from '../project/monorepo'
import {
  detectPackageManager,
  type PackageManager,
} from '../project/package-manager'

/**
 * What `init` learns about the project before it changes anything: where
 * the app is, how it builds and installs, which auth library sends its
 * emails today, and what else (billing, an email provider, editors) is
 * already there. Pure reads of the file system and the environment.
 */

export type FrameworkId =
  | 'next-app'
  | 'next-pages'
  | 'vite-react'
  | 'react-router'
  | 'remix'
  | 'sveltekit'
  | 'astro'
  | 'express'
  | 'hono'
  | 'supabase-functions'
  /** Any other Node server or script (fastify, koa, nest, nuxt, …). */
  | 'node'

export type AuthId =
  | 'better-auth'
  | 'authjs'
  | 'supabase'
  | 'clerk'
  | 'firebase'
  | 'workos'
  | 'stytch'
  | 'none'

/** Where server code runs, which decides how the generated client reads its key. */
export type Runtime = 'node' | 'workers' | 'deno' | 'browser'

export type ExistingEmail = {
  /** `resend`, `@sendgrid/mail`, `postmark`, `nodemailer`, `react-email`. */
  readonly provider: string
  readonly source: 'dependency' | 'directory'
  /** The directory of React Email templates, for `source: 'directory'`. */
  readonly path?: string
}

export type ProjectDetection = {
  /** The app directory init acts on (absolute). */
  readonly root: string
  readonly name: string
  readonly hasPackageJson: boolean
  readonly monorepo: {
    readonly tool: MonorepoInfo['tool']
    readonly root: string
    /** The app's directory relative to the monorepo root (POSIX). */
    readonly workspace: string | null
    readonly workspaceName: string | null
  } | null
  readonly packageManager: PackageManager
  readonly framework: FrameworkId
  /** The dependency that decided the framework, when one did. */
  readonly frameworkDependency: string | null
  readonly runtime: Runtime
  readonly auth: AuthId
  /** Auth.js major: `v4` (next-auth 4) or `v5` (next-auth 5, @auth/*). */
  readonly authVersion: 'v4' | 'v5' | null
  /** Every auth library found, strongest first (`auth` is the first). */
  readonly authDetected: readonly AuthId[]
  readonly billing: readonly string[]
  readonly existingEmail: readonly ExistingEmail[]
  /** The app builder that made the project, when it left a marker. */
  readonly builder: 'lovable' | 'bolt' | 'replit' | null
  readonly typescript: boolean
  /** `package.json#type === 'module'`. */
  readonly esm: boolean
  /** Next.js major version from the dependency range, when Next. */
  readonly nextMajor: number | null
  /** The minor of `next`'s declared range (`after` is stable from 15.1). */
  readonly nextMinor: number | null
  /** Root-relative directory for server-only helpers; null = no server. */
  readonly libDir: string | null
  readonly hasSupabaseDir: boolean
  /** The `@brew.new/sdk` range already declared, if any. */
  readonly sdkRange: string | null
  /** The SDK is declared, but not in `dependencies`. */
  readonly sdkDevOnly: boolean
  readonly editors: readonly McpClientId[]
  /** A cloud shell or CI (`Replit`, `GitHub Codespaces`, …). */
  readonly remote: string | null
}

export type DetectResult =
  | { readonly kind: 'project'; readonly project: ProjectDetection }
  | {
      /** A monorepo root with several apps: the caller must pick one. */
      readonly kind: 'ambiguous'
      readonly root: string
      readonly monorepo: MonorepoInfo
      readonly candidates: readonly AppCandidate[]
    }
  | {
      /** Nothing init can set up: no package.json, no Supabase functions. */
      readonly kind: 'none'
      readonly root: string
    }

function dependencies(
  pkg: Record<string, unknown> | null
): Map<string, string> {
  const deps = new Map<string, string>()
  if (pkg === null) {
    return deps
  }
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const record = pkg[field]
    if (typeof record === 'object' && record !== null) {
      for (const [name, range] of Object.entries(record)) {
        if (!deps.has(name)) {
          deps.set(name, typeof range === 'string' ? range : '')
        }
      }
    }
  }
  return deps
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function toPosix(path: string): string {
  return path.split(sep).join('/')
}

/** The first major version a dependency range names (`^15.1.0` → 15). */
export function rangeMajor(range: string | undefined): number | null {
  const match = /(\d+)(?:\.(\d+))?/.exec(range ?? '')
  return match === null ? null : Number(match[1])
}

/** `[major, minor]` of a range, for "at least SDK_RANGE" checks. */
export function rangeVersion(
  range: string | undefined
): readonly [number, number] | null {
  const match = /(\d+)\.(\d+)/.exec(range ?? '')
  return match === null ? null : [Number(match[1]), Number(match[2])]
}

function detectFrameworkId(
  root: string,
  deps: Map<string, string>,
  hasPackageJson: boolean
): {
  readonly framework: FrameworkId
  readonly dependency: string | null
} | null {
  const has = (name: string): boolean => deps.has(name)
  const dir = (path: string): boolean => isDir(join(root, path))
  if (has('next')) {
    const isPages =
      !(dir('app') || dir('src/app')) && (dir('pages') || dir('src/pages'))
    return {
      framework: isPages ? 'next-pages' : 'next-app',
      dependency: 'next',
    }
  }
  for (const [dependency, framework] of [
    ['@remix-run/react', 'remix'],
    ['@remix-run/node', 'remix'],
    ['@react-router/dev', 'react-router'],
    ['@sveltejs/kit', 'sveltekit'],
    ['astro', 'astro'],
    ['hono', 'hono'],
    ['express', 'express'],
    // Builds with Vite and React, but has a server: before the Vite branch.
    ['@tanstack/react-start', 'node'],
  ] as const) {
    if (has(dependency)) {
      return { framework, dependency }
    }
  }
  if (
    has('vite') &&
    (has('react') ||
      has('@vitejs/plugin-react') ||
      has('@vitejs/plugin-react-swc'))
  ) {
    return { framework: 'vite-react', dependency: 'vite' }
  }
  if (dir('supabase/functions')) {
    return { framework: 'supabase-functions', dependency: null }
  }
  if (hasPackageJson) {
    const other = [
      'fastify',
      'koa',
      '@nestjs/core',
      'nuxt',
      '@solidjs/start',
    ].find(has)
    return { framework: 'node', dependency: other ?? null }
  }
  return null
}

const AUTH_ORDER: readonly AuthId[] = [
  'better-auth',
  'authjs',
  'clerk',
  'workos',
  'stytch',
  'firebase',
  'supabase',
]

function detectAuth(
  deps: Map<string, string>,
  framework: FrameworkId
): {
  readonly auth: AuthId
  readonly version: 'v4' | 'v5' | null
  readonly all: readonly AuthId[]
} {
  const names = [...deps.keys()]
  const found = new Set<AuthId>()
  let version: 'v4' | 'v5' | null = null
  if (deps.has('better-auth')) {
    found.add('better-auth')
  }
  const nextAuth = deps.get('next-auth')
  if (nextAuth !== undefined) {
    found.add('authjs')
    version =
      /beta/.test(nextAuth) || (rangeMajor(nextAuth) ?? 0) >= 5 ? 'v5' : 'v4'
  } else if (
    names.some(
      (name) =>
        name.startsWith('@auth/') &&
        !name.endsWith('-adapter') &&
        !name.includes('adapter')
    )
  ) {
    found.add('authjs')
    version = 'v5'
  }
  if (names.some((name) => name.startsWith('@clerk/'))) {
    found.add('clerk')
  }
  if (names.some((name) => name.startsWith('@workos-inc/'))) {
    found.add('workos')
  }
  if (deps.has('stytch') || names.some((name) => name.startsWith('@stytch/'))) {
    found.add('stytch')
  }
  if (deps.has('firebase') || deps.has('firebase-admin')) {
    found.add('firebase')
  }
  if (
    deps.has('@supabase/supabase-js') ||
    deps.has('@supabase/ssr') ||
    names.some((name) => name.startsWith('@supabase/auth-helpers')) ||
    framework === 'supabase-functions'
  ) {
    found.add('supabase')
  }
  const all = AUTH_ORDER.filter((id) => found.has(id))
  const auth = all[0] ?? 'none'
  return { auth, version: auth === 'authjs' ? version : null, all }
}

const EMAIL_DEPENDENCIES: ReadonlyArray<readonly [string, string]> = [
  ['resend', 'resend'],
  ['@sendgrid/mail', '@sendgrid/mail'],
  ['postmark', 'postmark'],
  ['nodemailer', 'nodemailer'],
  ['@react-email/components', 'react-email'],
  ['@react-email/render', 'react-email'],
  ['react-email', 'react-email'],
]

function detectExistingEmail(
  root: string,
  deps: Map<string, string>
): ExistingEmail[] {
  const found: ExistingEmail[] = []
  const providers = new Set<string>()
  for (const [dependency, provider] of EMAIL_DEPENDENCIES) {
    if (deps.has(dependency) && !providers.has(provider)) {
      providers.add(provider)
      found.push({ provider, source: 'dependency' })
    }
  }
  for (const dir of [
    'emails',
    'src/emails',
    'react-email',
    'src/react-email',
  ]) {
    const absolute = join(root, dir)
    if (!isDir(absolute)) {
      continue
    }
    let entries: string[]
    try {
      entries = readdirSync(absolute)
    } catch {
      continue
    }
    if (entries.some((entry) => /\.(tsx|jsx)$/.test(entry))) {
      found.push({ provider: 'react-email', source: 'directory', path: dir })
      break
    }
  }
  return found
}

function detectBuilder(
  root: string,
  deps: Map<string, string>
): ProjectDetection['builder'] {
  if (deps.has('lovable-tagger')) {
    return 'lovable'
  }
  if (isDir(join(root, '.bolt'))) {
    return 'bolt'
  }
  if (existsSync(join(root, '.replit'))) {
    return 'replit'
  }
  return null
}

function libDirFor(
  root: string,
  framework: FrameworkId,
  hasSupabaseDir: boolean
): string | null {
  const dir = (path: string): boolean => isDir(join(root, path))
  switch (framework) {
    case 'vite-react':
      // A browser-only app: a server key must never be bundled into it.
      return null
    case 'supabase-functions':
      return hasSupabaseDir ? 'supabase/functions/_shared' : null
    case 'sveltekit':
      // `$lib/server` is the directory SvelteKit refuses to bundle for
      // the browser.
      return 'src/lib/server'
    case 'astro':
      return 'src/lib'
    case 'react-router':
    case 'remix':
      return dir('app') ? 'app/lib' : dir('src') ? 'src/lib' : 'lib'
    default:
      return dir('src') ? 'src/lib' : 'lib'
  }
}

export type DetectOptions = {
  /** `--app <dir>`: the app to set up inside a monorepo (relative to cwd). */
  readonly app?: string
  readonly env: Readonly<Record<string, string | undefined>>
}

export function detectProject(
  cwd: string,
  options: DetectOptions
): DetectResult {
  const start = options.app === undefined ? cwd : resolve(cwd, options.app)
  const resolved = resolveProjectRoot(start)
  // `--app` names the app itself: a typo must not set up a parent instead.
  if (options.app !== undefined && resolved.root !== start) {
    return { kind: 'none', root: start }
  }
  let root = resolved.root
  let workspace = resolved.monorepo?.workspace ?? null
  if (
    resolved.monorepo !== null &&
    workspace === null &&
    options.app === undefined
  ) {
    const apps = resolved.candidates
    if (apps.length > 1) {
      return {
        kind: 'ambiguous',
        root: resolved.monorepo.root,
        monorepo: resolved.monorepo,
        candidates: apps,
      }
    }
    const only = apps[0]
    if (only !== undefined) {
      root = join(resolved.monorepo.root, only.dir)
      workspace = { name: only.name, dir: only.dir }
    }
  }
  const pkg = readJsonObject(join(root, 'package.json'))
  const hasPackageJson = pkg !== null
  const deps = dependencies(pkg)
  const detected = detectFrameworkId(root, deps, hasPackageJson)
  if (detected === null) {
    return { kind: 'none', root }
  }
  const { framework } = detected
  const auth = detectAuth(deps, framework)
  const hasSupabaseDir = isDir(join(root, 'supabase'))
  const isWorkers =
    framework === 'hono' &&
    (['wrangler.toml', 'wrangler.json', 'wrangler.jsonc'].some((file) =>
      existsSync(join(root, file))
    ) ||
      deps.has('@cloudflare/workers-types'))
  const runtime: Runtime =
    framework === 'supabase-functions'
      ? 'deno'
      : framework === 'vite-react'
        ? 'browser'
        : isWorkers
          ? 'workers'
          : 'node'
  const monorepoRoot = resolved.monorepo?.root
  const packageManager = detectPackageManager(
    monorepoRoot === undefined || monorepoRoot === root
      ? [root]
      : [root, monorepoRoot],
    options.env
  )
  const typescript =
    existsSync(join(root, 'tsconfig.json')) ||
    deps.has('typescript') ||
    framework === 'supabase-functions'
  const name =
    pkg !== null && typeof pkg.name === 'string' && pkg.name !== ''
      ? pkg.name
      : basename(root)
  return {
    kind: 'project',
    project: {
      root,
      name,
      hasPackageJson,
      monorepo:
        resolved.monorepo === null
          ? null
          : {
              tool: resolved.monorepo.tool,
              root: resolved.monorepo.root,
              workspace:
                root === resolved.monorepo.root
                  ? null
                  : toPosix(relative(resolved.monorepo.root, root)),
              workspaceName: workspace?.name ?? null,
            },
      packageManager,
      framework,
      frameworkDependency: detected.dependency,
      runtime,
      auth: auth.auth,
      authVersion: auth.version,
      authDetected: auth.all,
      billing:
        deps.has('stripe') ||
        deps.has('@stripe/stripe-js') ||
        deps.has('@stripe/react-stripe-js')
          ? ['stripe']
          : [],
      existingEmail: detectExistingEmail(root, deps),
      builder: detectBuilder(root, deps),
      typescript,
      esm: pkg?.type === 'module',
      nextMajor: framework.startsWith('next-')
        ? rangeMajor(deps.get('next'))
        : null,
      nextMinor: framework.startsWith('next-')
        ? (rangeVersion(deps.get('next'))?.[1] ?? null)
        : null,
      libDir: libDirFor(root, framework, hasSupabaseDir),
      hasSupabaseDir,
      sdkRange: deps.get('@brew.new/sdk') ?? null,
      sdkDevOnly:
        deps.has('@brew.new/sdk') &&
        !dependencies({ dependencies: pkg?.dependencies }).has('@brew.new/sdk'),
      editors: detectMcpClients(monorepoRoot ?? root, options.env),
      remote: detectRemoteEnv(options.env)?.name ?? null,
    },
  }
}

/** Files that may hold the auth library's config, root-relative. */
const AUTH_CONFIG_CANDIDATES = [
  'auth.ts',
  'auth.js',
  'src/auth.ts',
  'src/auth.js',
  'lib/auth.ts',
  'lib/auth.js',
  'src/lib/auth.ts',
  'src/lib/auth.js',
  'src/lib/server/auth.ts',
  'app/lib/auth.ts',
  'app/lib/auth.server.ts',
  'app/auth.server.ts',
  'server/auth.ts',
  'src/server/auth.ts',
  'utils/auth.ts',
  'src/utils/auth.ts',
  'pages/api/auth/[...nextauth].ts',
  'pages/api/auth/[...nextauth].js',
  'src/pages/api/auth/[...nextauth].ts',
  'app/api/auth/[...nextauth]/route.ts',
  'src/app/api/auth/[...nextauth]/route.ts',
]

/**
 * The file that configures the auth library (`betterAuth({`, `NextAuth(`),
 * root-relative, or null when none of the usual places has it.
 */
export function findAuthConfig(
  root: string,
  auth: AuthId
): { readonly path: string; readonly text: string } | null {
  const marker =
    auth === 'better-auth'
      ? /\bbetterAuth\(/
      : auth === 'authjs'
        ? /\b(NextAuth|SvelteKitAuth|ExpressAuth)\(|providers\s*:\s*\[/
        : null
  if (marker === null) {
    return null
  }
  for (const path of AUTH_CONFIG_CANDIDATES) {
    const text = readTextFile(join(root, path))
    if (text !== null && marker.test(text)) {
      return { path, text }
    }
  }
  return null
}
