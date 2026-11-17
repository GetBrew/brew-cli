import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

/**
 * Keeps the launcher packages (`packages/launchers/{brew.new,create-brew}`)
 * in lockstep with the CLI: each one's version IS the CLI's, it depends on
 * exactly that `@brew.new/cli` version, and it carries a copy of the shared
 * `launcher.mjs` and the repo LICENSE.
 *   bun run sync:launchers          — write them
 *   bun run sync:launchers:check    — fail when anything drifted (CI, release)
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const LAUNCHERS_DIR = 'packages/launchers'
export const LAUNCHER_PACKAGES = ['brew.new', 'create-brew'] as const
export type LauncherName = (typeof LAUNCHER_PACKAGES)[number]

const DESCRIPTIONS: Readonly<Record<LauncherName, string>> = {
  'brew.new':
    'Set up Brew email in your app with one command: npx brew.new init (auth and lifecycle email, the SDK, MCP for your editor).',
  'create-brew':
    'npm create brew: set up Brew email in your app (auth and lifecycle email, the SDK, MCP for your editor).',
}

/** The package.json each launcher must have, for a CLI version. */
export function launcherManifest(
  name: LauncherName,
  version: string
): Record<string, unknown> {
  return {
    name,
    version,
    description: DESCRIPTIONS[name],
    license: 'MIT',
    author: 'Brew',
    homepage: 'https://brew.new/developers',
    repository: {
      type: 'git',
      url: 'git+https://github.com/GetBrew/brew-cli.git',
      directory: `${LAUNCHERS_DIR}/${name}`,
    },
    bugs: { url: 'https://github.com/GetBrew/brew-cli/issues' },
    keywords: [
      'brew',
      'brew.new',
      'email',
      'init',
      'transactional-email',
      'auth-emails',
      'better-auth',
      'next-auth',
      'supabase',
      'resend-alternative',
      'mcp',
      'cli',
    ],
    type: 'module',
    // npm 11 strips a bin path prefixed with `./` during publish packing.
    bin: { [name]: 'bin.mjs' },
    files: ['bin.mjs', 'launcher.mjs', 'README.md', 'LICENSE'],
    engines: { node: '>=20' },
    // Exact: a launcher version always runs the CLI of the same version.
    dependencies: { '@brew.new/cli': version },
    publishConfig: { access: 'public' },
  }
}

type Drift = { readonly path: string; readonly fix: () => void }

function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

/** Every launcher file that differs from what the CLI version implies. */
export function launcherDrift(root: string = REPO_ROOT): Drift[] {
  const { version } = JSON.parse(
    readFileSync(join(root, 'package.json'), 'utf8')
  ) as { version: string }
  const launcher = readFileSync(
    join(root, LAUNCHERS_DIR, 'launcher.mjs'),
    'utf8'
  )
  const license = readFileSync(join(root, 'LICENSE'), 'utf8')
  const drift: Drift[] = []
  for (const name of LAUNCHER_PACKAGES) {
    const dir = join(root, LAUNCHERS_DIR, name)
    for (const [file, content] of [
      ['launcher.mjs', launcher],
      ['LICENSE', license],
    ] as const) {
      const path = join(dir, file)
      if (readText(path) !== content) {
        drift.push({ path, fix: () => writeFileSync(path, content) })
      }
    }
    const manifestPath = join(dir, 'package.json')
    const expected = launcherManifest(name, version)
    const current = readText(manifestPath)
    let parsed: unknown
    try {
      parsed = current === null ? null : JSON.parse(current)
    } catch {
      parsed = null
    }
    // Compared as data: formatting is the formatter's business.
    if (!isDeepStrictEqual(parsed, expected)) {
      drift.push({
        path: manifestPath,
        fix: () =>
          writeFileSync(manifestPath, `${JSON.stringify(expected, null, 2)}\n`),
      })
    }
  }
  return drift
}

function main(): void {
  const drift = launcherDrift()
  if (process.argv.includes('--check')) {
    if (drift.length > 0) {
      for (const entry of drift) {
        console.error(`${entry.path} is out of date.`)
      }
      console.error('Run `bun run sync:launchers` and commit.')
      process.exit(1)
    }
    console.log('Launchers match the CLI version.')
    return
  }
  for (const entry of drift) {
    entry.fix()
    console.log(`Wrote ${entry.path}`)
  }
  if (drift.length === 0) {
    console.log('Launchers already match the CLI version.')
  }
}

const entry = process.argv[1]
if (entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url)) {
  main()
}
