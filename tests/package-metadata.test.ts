import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

type PackageManifest = {
  readonly bin?: Readonly<Record<string, string>>
  readonly files?: readonly string[]
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
})
