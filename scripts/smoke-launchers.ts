import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LAUNCHER_PACKAGES, LAUNCHERS_DIR } from './sync-launchers'

/**
 * Packs the CLI and both launchers the way npm publishes them, installs
 * them into a scratch project, and runs each launcher's `--version` and
 * `--help`. Needs `bun run build` first (the CLI tarball ships `dist/`).
 *
 *   bun run smoke:launchers              — offline: the packed CLI, with its
 *                                          dependencies linked from this repo
 *   bun run smoke:launchers --registry   — `npm install` the launcher tarballs,
 *                                          resolving `@brew.new/cli` from npm
 *                                          (release, after the CLI publishes)
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const EXPECTED_FILES = [
  'package/LICENSE',
  'package/README.md',
  'package/bin.mjs',
  'package/launcher.mjs',
  'package/package.json',
]

function run(command: string, args: readonly string[], cwd: string): string {
  return execFileSync(command, [...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** `npm pack` into `destination`; returns the tarball path. */
function pack(dir: string, destination: string): string {
  const output = run(
    'npm',
    ['pack', '--ignore-scripts', '--json', '--pack-destination', destination],
    dir
  )
  const [packed] = JSON.parse(output) as Array<{ filename: string }>
  if (packed === undefined) {
    throw new Error(`npm pack produced nothing in ${dir}`)
  }
  return join(destination, packed.filename)
}

function extract(tarball: string, into: string): void {
  mkdirSync(into, { recursive: true })
  run('tar', ['-xzf', tarball, '-C', into, '--strip-components=1'], into)
}

function listTarball(tarball: string): string[] {
  return run('tar', ['-tzf', tarball], dirname(tarball))
    .split('\n')
    .filter((line) => line !== '')
    .sort()
}

function link(target: string, path: string): void {
  mkdirSync(dirname(path), { recursive: true })
  symlinkSync(realpathSync(target), path, 'dir')
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => {
    setTimeout(done, ms)
  })
}

async function main(): Promise<void> {
  const isRegistry = process.argv.includes('--registry')
  if (!existsSync(join(REPO_ROOT, 'dist/bin.js'))) {
    throw new Error('dist/bin.js is missing: run `bun run build` first.')
  }
  const { version } = JSON.parse(
    readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')
  ) as { version: string }
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'brew-launchers-')))
  try {
    const tarballs = join(scratch, 'tarballs')
    mkdirSync(tarballs)
    const project = join(scratch, 'project')
    mkdirSync(project)
    writeFileSync(
      join(project, 'package.json'),
      '{"name":"launcher-smoke","private":true}\n'
    )
    const modules = join(project, 'node_modules')
    const launchers = LAUNCHER_PACKAGES.map((name) => {
      const tarball = pack(join(REPO_ROOT, LAUNCHERS_DIR, name), tarballs)
      const files = listTarball(tarball)
      if (JSON.stringify(files) !== JSON.stringify(EXPECTED_FILES)) {
        throw new Error(
          `${name} packs ${files.join(', ')}; expected ${EXPECTED_FILES.join(', ')}`
        )
      }
      return { name, tarball }
    })
    if (isRegistry) {
      // The CLI was just published: npm may need a moment to serve it.
      for (let attempt = 1; ; attempt += 1) {
        try {
          run(
            'npm',
            [
              'install',
              '--no-audit',
              '--no-fund',
              ...launchers.map((entry) => entry.tarball),
            ],
            project
          )
          break
        } catch (error) {
          if (attempt === 6) {
            throw error
          }
          console.log(`npm install failed (attempt ${attempt}); retrying…`)
          await sleep(10_000)
        }
      }
    } else {
      const cli = pack(REPO_ROOT, tarballs)
      extract(cli, join(modules, '@brew.new/cli'))
      for (const dependency of ['@brew.new/sdk', 'commander']) {
        link(
          join(REPO_ROOT, 'node_modules', dependency),
          join(modules, dependency)
        )
      }
      for (const entry of launchers) {
        extract(entry.tarball, join(modules, entry.name))
      }
    }
    for (const entry of launchers) {
      const bin = join(modules, entry.name, 'bin.mjs')
      const printed = run(process.execPath, [bin, '--version'], project).trim()
      if (printed !== version) {
        throw new Error(
          `${entry.name} --version printed "${printed}", not ${version}`
        )
      }
      const help = run(process.execPath, [bin, '--help'], project)
      const expected =
        entry.name === 'create-brew'
          ? 'Usage: brew-cli init'
          : 'Usage: brew-cli'
      if (!help.includes(expected)) {
        throw new Error(`${entry.name} --help did not print "${expected}"`)
      }
      console.log(`${entry.name}@${version}: --version and --help ok`)
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

const entry = process.argv[1]
if (entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url)) {
  await main()
}
