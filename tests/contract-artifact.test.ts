import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, expect, it } from 'vitest'

const consumerName = '@brew.new/cli'
const generatedPaths = [
  'src/generated/openapi-types.ts',
  ...(consumerName.endsWith('/cli') ? ['src/generated/input-keys.ts'] : []),
]
const managedPaths = [
  'openapi/public-api-v1.yaml',
  'scripts/contract-artifact.mjs',
  'openapi/contract-manifest.json',
  'contract.lock.json',
  ...generatedPaths,
]
const importer = readFileSync(
  new URL('../scripts/contract-artifact.mjs', import.meta.url),
  'utf8'
)
const directories: Array<string> = []
const digest = (value: string): string =>
  createHash('sha256').update(value).digest('hex')

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function write(root: string, path: string, value: string): void {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, value)
}

function fixture(hasGeneratorFailure = false) {
  const directory = mkdtempSync(join(tmpdir(), 'brew-contract-import-'))
  directories.push(directory)
  const root = join(directory, 'consumer')
  const artifact = join(directory, 'artifact')
  const source = (revision: string) => ({
    repository: 'GetBrew/brew-v2',
    revision: revision.repeat(40),
    dirty: false,
  })
  write(root, 'package.json', JSON.stringify({ name: consumerName }))
  const previousFiles = {
    'openapi/public-api-v1.yaml': 'old public spec\n',
    'tools/contract-artifact.mjs': importer,
  }
  const previousManifest = JSON.stringify({
    schemaVersion: 1,
    source: source('a'),
    files: Object.fromEntries(
      Object.entries(previousFiles).map(([path, value]) => [
        path,
        digest(value),
      ])
    ),
  })
  write(
    root,
    'openapi/public-api-v1.yaml',
    previousFiles['openapi/public-api-v1.yaml']
  )
  write(root, 'scripts/contract-artifact.mjs', importer)
  write(root, 'openapi/contract-manifest.json', previousManifest)
  write(
    root,
    'contract.lock.json',
    JSON.stringify({
      schemaVersion: 1,
      artifactSha256: digest(previousManifest),
      source: source('a'),
    })
  )
  for (const path of generatedPaths) write(root, path, `old ${path}\n`)
  const generator = [
    "import { writeFileSync } from 'node:fs'",
    ...generatedPaths.map(
      (path) =>
        `writeFileSync(${JSON.stringify(path)}, ${JSON.stringify(`new ${path}\n`)})`
    ),
    ...(hasGeneratorFailure ? ['process.exit(1)'] : []),
  ].join('\n')
  write(root, 'scripts/generate-types.mjs', generator)
  const payloads = {
    'openapi/public-api-v1.yaml': 'new public spec\n',
    'tools/contract-artifact.mjs': `${importer}\n// verified new artifact\n`,
  }
  for (const [path, value] of Object.entries(payloads))
    write(artifact, path, value)
  const manifest = {
    schemaVersion: 1,
    source: source('b'),
    files: Object.fromEntries(
      Object.entries(payloads).map(([path, value]) => [path, digest(value)])
    ),
  }
  const updateManifest = (): string => {
    const bytes = JSON.stringify(manifest)
    write(artifact, 'manifest.json', bytes)
    return digest(bytes)
  }
  const artifactSha256 = updateManifest()
  const snapshot = () =>
    Object.fromEntries(
      managedPaths.map((path) => [
        path,
        existsSync(join(root, path))
          ? readFileSync(join(root, path), 'utf8')
          : null,
      ])
    )
  const run = (expectedDigest = artifactSha256) =>
    spawnSync(
      process.execPath,
      [
        'scripts/contract-artifact.mjs',
        'import',
        '--artifact',
        artifact,
        '--digest',
        expectedDigest,
      ],
      { cwd: root, encoding: 'utf8', timeout: 10_000 }
    )
  return {
    root,
    artifact,
    manifest,
    artifactSha256,
    updateManifest,
    snapshot,
    run,
  }
}

it('imports a complete verified artifact and generates consumer outputs', () => {
  const state = fixture()
  const result = state.run()
  expect(result.status, result.stderr).toBe(0)
  expect(
    readFileSync(join(state.root, 'openapi/public-api-v1.yaml'), 'utf8')
  ).toBe('new public spec\n')
  for (const path of generatedPaths) {
    expect(readFileSync(join(state.root, path), 'utf8')).toBe(`new ${path}\n`)
  }
  expect(
    JSON.parse(readFileSync(join(state.root, 'contract.lock.json'), 'utf8'))
  ).toMatchObject({
    artifactSha256: state.artifactSha256,
    source: { revision: 'b'.repeat(40) },
  })
})

it.each(['manifest', 'payload'])(
  'rejects a mismatched %s digest before writing',
  (part) => {
    const state = fixture()
    const before = state.snapshot()
    if (part === 'payload')
      write(state.artifact, 'openapi/public-api-v1.yaml', 'tampered bytes')
    const result = state.run(
      part === 'manifest' ? '0'.repeat(64) : state.artifactSha256
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('digest mismatch')
    expect(state.snapshot()).toEqual(before)
  }
)

it('rejects an unsupported manifest path before writing any consumer file', () => {
  const state = fixture()
  const before = state.snapshot()
  state.manifest.files['../outside.txt'] = digest('outside')
  const result = state.run(state.updateManifest())
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('unsupported artifact path')
  expect(state.snapshot()).toEqual(before)
  expect(existsSync(join(state.root, '../outside.txt'))).toBe(false)
})

it('refuses an escaping destination symlink without changing its target', () => {
  const state = fixture()
  const outside = join(state.root, '../outside.yaml')
  writeFileSync(outside, 'outside remains unchanged')
  rmSync(join(state.root, 'openapi/public-api-v1.yaml'))
  symlinkSync(outside, join(state.root, 'openapi/public-api-v1.yaml'))
  const before = state.snapshot()
  const result = state.run()
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('outside the consumer checkout')
  expect(state.snapshot()).toEqual(before)
  expect(readFileSync(outside, 'utf8')).toBe('outside remains unchanged')
})

it.each([false, true])(
  'restores every managed file after a partial generator failure (new outputs=%s)',
  (hasNewOutputs) => {
    const state = fixture(true)
    if (hasNewOutputs) {
      for (const path of generatedPaths) rmSync(join(state.root, path))
    }
    const before = state.snapshot()
    const result = state.run()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Contract type generation failed')
    expect(state.snapshot()).toEqual(before)
  }
)

it('refuses a managed symlink to an unmanaged file inside the checkout', () => {
  const state = fixture()
  const manual = join(state.root, 'manual-sample.yaml')
  writeFileSync(manual, 'manual content must survive')
  rmSync(join(state.root, 'openapi/public-api-v1.yaml'))
  symlinkSync(manual, join(state.root, 'openapi/public-api-v1.yaml'))
  const before = state.snapshot()
  const result = state.run()
  expect(result.status).toBe(1)
  expect(state.snapshot()).toEqual(before)
  expect(readFileSync(manual, 'utf8')).toBe('manual content must survive')
})
