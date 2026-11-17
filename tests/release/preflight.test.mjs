import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { assertReleaseManifest } from '../../scripts/check-release.mjs'

const manifest = {
  version: '0.19.0',
  dependencies: { '@brew.new/sdk': '^13.5.0' },
}

test('release blocks git, local and alias SDK dependencies', () => {
  for (const dependency of [
    'git+https://github.com/GetBrew/typescript-sdk.git#abc',
    'file:../sdk',
    'workspace:*',
    'npm:other@13.5.0',
    'latest',
    undefined,
  ]) {
    assert.throws(
      () =>
        assertReleaseManifest({
          ...manifest,
          dependencies: { '@brew.new/sdk': dependency },
        }),
      /published registry SDK/
    )
  }
})

test('release accepts explicit registry versions and supported ranges', () => {
  for (const dependency of ['13.5.0', '^13.5.0', '~13.5.0', '13.5.0-beta.1']) {
    assert.doesNotThrow(() =>
      assertReleaseManifest({
        ...manifest,
        dependencies: { '@brew.new/sdk': dependency },
      })
    )
  }
})

test('publication fails without npm authentication and never echoes a supplied token', () => {
  assert.throws(
    () =>
      assertReleaseManifest(manifest, { isPublishing: true, tag: 'v0.19.0' }),
    /NPM_TOKEN/
  )
  assert.throws(
    () =>
      assertReleaseManifest(manifest, {
        isPublishing: true,
        npmToken: 'private-token',
        tag: 'v0.20.0',
      }),
    /tag/
  )
})

test('publication requires an exact tag and accepts a valid release input', () => {
  assert.throws(
    () =>
      assertReleaseManifest(manifest, { isPublishing: true, npmToken: 'test' }),
    /tag/
  )
  assert.doesNotThrow(() =>
    assertReleaseManifest(manifest, {
      isPublishing: true,
      npmToken: 'test',
      tag: 'v0.19.0',
    })
  )
})

test('CLI entrypoint rejects a source pin without reaching publication', () => {
  const directory = mkdtempSync(join(tmpdir(), 'brew-release-gate-'))
  try {
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({
        ...manifest,
        dependencies: { '@brew.new/sdk': 'github:GetBrew/typescript-sdk#abc' },
      })
    )
    const result = spawnSync(
      process.execPath,
      [resolve('scripts/check-release.mjs')],
      { cwd: directory, encoding: 'utf8' }
    )
    assert.equal(result.status, 1)
    assert.match(result.stderr, /published registry SDK/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
