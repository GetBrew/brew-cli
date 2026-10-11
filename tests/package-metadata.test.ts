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
