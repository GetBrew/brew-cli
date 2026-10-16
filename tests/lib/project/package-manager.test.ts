import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  addCommand,
  detectPackageManager,
  dlxCommand,
  execCommand,
  formatCommandLine,
  installCommand,
  type PackageManager,
  parsePackageManagerField,
  parseUserAgent,
} from '../../../src/lib/project/package-manager'
import { copyFixture, tempProject } from '../../helpers/fixtures'

const WEB = { name: 'web', dir: 'apps/web' }

function pm(
  name: PackageManager['name'],
  rest: Partial<PackageManager> = {}
): PackageManager {
  return { name, source: 'lockfile', ...rest }
}

describe('detectPackageManager', () => {
  it('prefers package.json#packageManager, version included', () => {
    const root = copyFixture('pnpm-turbo')
    expect(detectPackageManager([join(root, 'apps/web'), root])).toEqual({
      name: 'pnpm',
      version: '9.12.0',
      source: 'packageManager',
    })
  })

  it('reads yarn berry with Plug and Play from .yarnrc.yml', () => {
    const root = copyFixture('yarn-berry-pnp')
    expect(detectPackageManager([root])).toEqual({
      name: 'yarn',
      source: 'lockfile',
      lockfile: 'yarn.lock',
      yarnFlavor: 'berry',
      pnp: true,
    })
  })

  it('tells yarn classic from its v1 lockfile', () => {
    const root = copyFixture('yarn-classic')
    expect(detectPackageManager([root])).toMatchObject({
      name: 'yarn',
      yarnFlavor: 'classic',
      pnp: false,
    })
  })

  it('reads berry without PnP when nodeLinker says node-modules', () => {
    const root = copyFixture('yarn-berry-pnp')
    writeFileSync(join(root, '.yarnrc.yml'), 'nodeLinker: node-modules\n')
    expect(detectPackageManager([root])).toMatchObject({
      yarnFlavor: 'berry',
      pnp: false,
    })
  })

  it('classifies a yarn@4 packageManager pin as berry', () => {
    const root = tempProject()
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ packageManager: 'yarn@4.5.0' })
    )
    expect(detectPackageManager([root])).toMatchObject({
      name: 'yarn',
      version: '4.5.0',
      yarnFlavor: 'berry',
    })
  })

  it('detects bun from bun.lock and from the binary bun.lockb', () => {
    expect(detectPackageManager([copyFixture('bun')])).toMatchObject({
      name: 'bun',
      lockfile: 'bun.lock',
    })
    const root = tempProject()
    writeFileSync(join(root, 'package.json'), '{}')
    writeFileSync(join(root, 'bun.lockb'), Buffer.from([0x23, 0x21, 0x00]))
    expect(detectPackageManager([root])).toMatchObject({
      name: 'bun',
      lockfile: 'bun.lockb',
    })
  })

  it('detects npm and deno from their lockfiles', () => {
    expect(detectPackageManager([copyFixture('next-app')])).toMatchObject({
      name: 'npm',
      lockfile: 'package-lock.json',
    })
    expect(detectPackageManager([copyFixture('deno')])).toMatchObject({
      name: 'deno',
      lockfile: 'deno.lock',
    })
  })

  it('finds the lockfile at the monorepo root when the app has none', () => {
    const root = copyFixture('npm-workspaces')
    expect(detectPackageManager([join(root, 'apps/site'), root])).toMatchObject(
      { name: 'npm', lockfile: 'package-lock.json' }
    )
  })

  it('reports conflicting lockfiles from different managers', () => {
    const root = copyFixture('next-app')
    writeFileSync(join(root, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n")
    expect(detectPackageManager([root])).toMatchObject({
      name: 'pnpm',
      conflictingLockfiles: ['pnpm-lock.yaml', 'package-lock.json'],
    })
  })

  it('falls back to the launching user agent, then npm', () => {
    const root = copyFixture('no-package-json')
    expect(
      detectPackageManager([root], {
        npm_config_user_agent: 'bun/1.3.10 npm/? node/v24.3.0 darwin arm64',
      })
    ).toEqual({ name: 'bun', version: '1.3.10', source: 'user-agent' })
    expect(detectPackageManager([root], {})).toEqual({
      name: 'npm',
      source: 'default',
    })
  })
})

describe('field parsers', () => {
  it('parses packageManager pins and rejects strangers', () => {
    expect(parsePackageManagerField('pnpm@9.1.0+sha512.abc')).toEqual({
      name: 'pnpm',
      version: '9.1.0',
    })
    expect(parsePackageManagerField('volta@1.0.0')).toBeNull()
    expect(parsePackageManagerField(42)).toBeNull()
  })

  it('parses npm_config_user_agent', () => {
    expect(parseUserAgent('yarn/1.22.22 npm/? node/v20.11.0')).toEqual({
      name: 'yarn',
      version: '1.22.22',
    })
    expect(parseUserAgent(undefined)).toBeNull()
  })
})

describe('command builders', () => {
  it('adds a dependency, workspace-aware, for every manager', () => {
    const cases: Array<[PackageManager, string]> = [
      [pm('npm'), 'npm install --workspace web @brew.new/sdk'],
      [pm('pnpm'), 'pnpm add --filter web @brew.new/sdk'],
      [
        pm('yarn', { yarnFlavor: 'classic' }),
        'yarn workspace web add @brew.new/sdk',
      ],
      [
        pm('yarn', { yarnFlavor: 'berry' }),
        'yarn workspace web add @brew.new/sdk',
      ],
      [pm('bun'), 'cd apps/web && bun add @brew.new/sdk'],
      [pm('deno'), 'cd apps/web && deno add npm:@brew.new/sdk'],
    ]
    for (const [manager, expected] of cases) {
      expect(
        formatCommandLine(
          addCommand(manager, ['@brew.new/sdk'], { workspace: WEB })
        )
      ).toBe(expected)
    }
  })

  it('adds dev dependencies at the root', () => {
    expect(
      formatCommandLine(addCommand(pm('npm'), ['msw'], { dev: true }))
    ).toBe('npm install --save-dev msw')
    expect(
      formatCommandLine(
        addCommand(pm('pnpm'), ['msw'], { dev: true, exact: true })
      )
    ).toBe('pnpm add --save-dev --save-exact msw')
    expect(
      formatCommandLine(
        addCommand(pm('yarn', { yarnFlavor: 'classic' }), ['msw'], {
          dev: true,
        })
      )
    ).toBe('yarn add --dev msw')
  })

  it('installs, frozen or not', () => {
    expect(formatCommandLine(installCommand(pm('npm'), { frozen: true }))).toBe(
      'npm ci'
    )
    expect(
      formatCommandLine(
        installCommand(pm('yarn', { yarnFlavor: 'berry' }), { frozen: true })
      )
    ).toBe('yarn install --immutable')
    expect(
      formatCommandLine(
        installCommand(pm('yarn', { yarnFlavor: 'classic' }), { frozen: true })
      )
    ).toBe('yarn install --frozen-lockfile')
    expect(formatCommandLine(installCommand(pm('bun')))).toBe('bun install')
  })

  it('runs project binaries per manager', () => {
    expect(
      formatCommandLine(
        execCommand(pm('pnpm'), 'tsc', ['--noEmit'], { workspace: WEB })
      )
    ).toBe('pnpm --filter web exec tsc --noEmit')
    expect(
      formatCommandLine(
        execCommand(pm('npm'), 'tsc', ['--noEmit'], { workspace: WEB })
      )
    ).toBe('npm exec --workspace web -- tsc --noEmit')
    expect(
      formatCommandLine(
        execCommand(pm('yarn', { yarnFlavor: 'classic' }), 'tsc')
      )
    ).toBe('yarn tsc')
    expect(
      formatCommandLine(execCommand(pm('yarn', { yarnFlavor: 'berry' }), 'tsc'))
    ).toBe('yarn exec tsc')
    expect(formatCommandLine(execCommand(pm('bun'), 'tsc'))).toBe('bun x tsc')
  })

  it('downloads-and-runs a package once', () => {
    expect(
      formatCommandLine(dlxCommand(pm('npm'), 'brew.new@0.18.0', ['init']))
    ).toBe('npx -y brew.new@0.18.0 init')
    expect(formatCommandLine(dlxCommand(pm('pnpm'), 'brew.new'))).toBe(
      'pnpm dlx brew.new'
    )
    expect(
      formatCommandLine(dlxCommand(pm('yarn', { yarnFlavor: 'classic' }), 'x'))
    ).toBe('npx -y x')
    expect(formatCommandLine(dlxCommand(pm('bun'), 'x'))).toBe('bunx x')
  })

  it('shell-quotes arguments that need it', () => {
    expect(
      formatCommandLine({
        command: 'npm',
        args: ['install', "it's"],
        cwd: 'apps/my app',
      })
    ).toBe(`cd 'apps/my app' && npm install 'it'\\''s'`)
  })
})
