import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

type PackageManifest = {
  readonly bin?: Readonly<Record<string, string>>
  readonly files?: readonly string[]
  readonly keywords?: readonly string[]
  readonly dependencies?: Readonly<Record<string, string>>
}

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as PackageManifest

describe('npm package metadata', () => {
  it('ships the compiled brew-cli executable', () => {
    // npm 11 strips a bin path prefixed with `./` during publish packing.
    expect(manifest.bin).toEqual({ 'brew-cli': 'dist/bin.js' })
    expect(manifest.files).toContain('dist')
  })

  it('ships the brew.json schema its $schema URL points at', () => {
    expect(manifest.files).toContain('schemas')
  })

  it('is discoverable under the MCP, email and agent keywords', () => {
    for (const keyword of [
      'mcp',
      'model-context-protocol',
      'email',
      'transactional-email',
      'resend',
      'resend-alternative',
      'react-email',
      'ai-agent',
      'agents',
      'auth-emails',
    ]) {
      expect(manifest.keywords).toContain(keyword)
    }
  })

  it('keeps exactly two runtime dependencies', () => {
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual([
      '@brew.new/sdk',
      'commander',
    ])
  })
})

type LauncherManifest = PackageManifest & {
  readonly name?: string
  readonly version?: string
  readonly type?: string
  readonly engines?: Readonly<Record<string, string>>
  readonly publishConfig?: Readonly<Record<string, string>>
}

const cliVersion = (
  JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  ) as { version: string }
).version

describe.each(['brew.new', 'create-brew'])('launcher %s', (name) => {
  const dir = new URL(`../packages/launchers/${name}/`, import.meta.url)
  const launcher = JSON.parse(
    readFileSync(new URL('package.json', dir), 'utf8')
  ) as LauncherManifest

  it('is the CLI version, pinned exactly to the CLI', () => {
    expect(launcher.name).toBe(name)
    expect(launcher.version).toBe(cliVersion)
    expect(launcher.dependencies).toEqual({ '@brew.new/cli': cliVersion })
  })

  it('ships one ESM bin with a node shebang and nothing else', () => {
    expect(launcher.bin).toEqual({ [name]: 'bin.mjs' })
    expect(launcher.type).toBe('module')
    expect(launcher.files).toEqual([
      'bin.mjs',
      'launcher.mjs',
      'README.md',
      'LICENSE',
    ])
    expect(launcher.engines).toEqual({ node: '>=20' })
    expect(launcher.publishConfig).toEqual({ access: 'public' })
    expect(
      readFileSync(new URL('bin.mjs', dir), 'utf8').startsWith(
        '#!/usr/bin/env node\n'
      )
    ).toBe(true)
  })

  it('keeps the CLI package itself free of launcher files', () => {
    expect(manifest.files).not.toContain('packages')
  })
})
