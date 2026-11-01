import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  hasSubcommand,
  invokedAs,
  launch,
  launcherArgv,
} from '../packages/launchers/launcher.mjs'
import { LAUNCHER_PACKAGES, launcherDrift } from '../scripts/sync-launchers'
import { initCommand } from '../src/commands/init'
import { getInvocationPrefix } from '../src/lib/invocation'
import { copyFixture } from './helpers/fixtures'
import { runCli } from './helpers/run-cli'

describe('launcher argv', () => {
  it.each([
    [[], ['init']],
    [
      ['--dry-run', '--json'],
      ['init', '--dry-run', '--json'],
    ],
    [
      ['--yes', '--app', 'apps/web'],
      ['init', '--yes', '--app', 'apps/web'],
    ],
    [
      ['--api-url', 'http://localhost:3000/api'],
      ['init', '--api-url', 'http://localhost:3000/api'],
    ],
    [
      ['init', '--yes'],
      ['init', '--yes'],
    ],
    [
      ['send', 'lifecycle.welcome', '--to', 'a@b.c'],
      ['send', 'lifecycle.welcome', '--to', 'a@b.c'],
    ],
    [
      ['--api-url', 'http://x/api', 'login'],
      ['--api-url', 'http://x/api', 'login'],
    ],
    [['--version'], ['--version']],
    [['--help'], ['--help']],
  ] as const)('brew.new %j → %j', (args, expected) => {
    expect(launcherArgv(args)).toEqual(expected)
  })

  it.each([
    [[], ['init']],
    [['--help'], ['init', '--help']],
    [['--version'], ['--version']],
    [
      ['init', '--resume', '--yes'],
      ['init', '--resume', '--yes'],
    ],
    [
      ['send', 'x', '--to', 'a@b.c'],
      ['send', 'x', '--to', 'a@b.c'],
    ],
  ] as const)('create-brew %j → %j', (args, expected) => {
    expect(launcherArgv(args, { alwaysInit: true })).toEqual(expected)
  })

  it('treats a flag value as a value, not a subcommand', () => {
    expect(hasSubcommand(['--domain', 'mail.acme.com'])).toBe(false)
    expect(hasSubcommand(['--domain=mail.acme.com', 'init'])).toBe(true)
  })

  it.each(
    initCommand.flags
      .map((spec) => spec.flag.split(' '))
      .filter(([, value]) => value !== undefined)
      .map(([name]) => name)
  )('treats the value of init %s as a value', (name) => {
    expect(hasSubcommand([name, 'https://acme.com'])).toBe(false)
  })
})

describe('BREW_CLI_INVOKED_AS from a launcher', () => {
  it('pins npx to the launcher version and is accepted as a prefix', () => {
    expect(invokedAs('brew.new', '0.18.0')).toBe('npx -y brew.new@0.18.0')
    expect(
      getInvocationPrefix({
        BREW_CLI_INVOKED_AS: invokedAs('brew.new', '0.18.0'),
      })
    ).toBe('npx -y brew.new@0.18.0')
    expect(invokedAs('create-brew', '0.18.0')).toBe('npm create brew@0.18.0 --')
    expect(
      getInvocationPrefix({
        BREW_CLI_INVOKED_AS: invokedAs('create-brew', '0.18.0'),
      })
    ).toBe('npm create brew@0.18.0 --')
  })

  it('a printed command re-enters through the launcher without a second init', async () => {
    const root = copyFixture('next-better-auth')
    const env = {
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-launcher-')),
      BREW_CLI_INVOKED_AS: invokedAs('create-brew', '0.18.0'),
    }
    const result = await runCli(
      launcherArgv(['--json'], { alwaysInit: true }),
      {
        cwd: root,
        env,
      }
    )
    expect(result.code).toBe(4)
    const { confirmCommand } = result.json as { confirmCommand: string }
    expect(confirmCommand).toBe('npm create brew@0.18.0 -- init --json --yes')
    // What npm hands the launcher for that command: init stays single.
    const rerun = confirmCommand.split(' ').slice(4)
    expect(launcherArgv(rerun, { alwaysInit: true })).toEqual([
      'init',
      '--json',
      '--yes',
    ])
  })
})

describe('launch()', () => {
  it('rewrites argv in place, names the launcher, then loads the CLI once', async () => {
    const argv = ['node', '/x/bin.mjs', '--dry-run']
    const env: Record<string, string | undefined> = {}
    const seen: string[][] = []
    await launch({
      packageName: 'brew.new',
      version: '0.18.0',
      argv,
      env,
      importCli: async () => {
        seen.push([...argv])
      },
    })
    expect(seen).toEqual([['node', '/x/bin.mjs', 'init', '--dry-run']])
    expect(env.BREW_CLI_INVOKED_AS).toBe('npx -y brew.new@0.18.0')
  })

  it('keeps a BREW_CLI_INVOKED_AS the caller already set', async () => {
    const env: Record<string, string | undefined> = {
      BREW_CLI_INVOKED_AS: 'pnpm dlx brew.new@0.18.0',
    }
    await launch({
      packageName: 'brew.new',
      version: '0.18.0',
      argv: ['node', 'bin.mjs'],
      env,
      importCli: async () => undefined,
    })
    expect(env.BREW_CLI_INVOKED_AS).toBe('pnpm dlx brew.new@0.18.0')
  })
})

describe('launcher packages', () => {
  it('match the CLI version, launcher source and LICENSE (sync:launchers)', () => {
    expect(launcherDrift().map((entry) => entry.path)).toEqual([])
  })

  it.each(LAUNCHER_PACKAGES)('%s packs exactly its five files', (name) => {
    const output = execFileSync(
      'npm',
      ['pack', '--dry-run', '--json', '--ignore-scripts'],
      {
        cwd: join(import.meta.dirname, '../packages/launchers', name),
        encoding: 'utf8',
      }
    )
    const [packed] = JSON.parse(output) as Array<{
      files: Array<{ path: string; mode: number }>
    }>
    expect(packed?.files.map((file) => file.path).sort()).toEqual([
      'LICENSE',
      'README.md',
      'bin.mjs',
      'launcher.mjs',
      'package.json',
    ])
    const bin = packed?.files.find((file) => file.path === 'bin.mjs')
    expect((bin?.mode ?? 0) & 0o111).not.toBe(0)
  })
})
