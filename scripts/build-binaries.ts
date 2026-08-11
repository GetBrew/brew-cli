import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Compiles standalone binaries for every supported platform with
 * `bun build --compile`. Run from the repo root under Bun:
 *   bun run scripts/build-binaries.ts
 * Outputs dist-bin/brew-cli-<os>-<arch>[.exe] plus checksums.txt.
 */

const TARGETS = [
  { target: 'bun-darwin-arm64', artifact: 'brew-cli-darwin-arm64' },
  { target: 'bun-darwin-x64', artifact: 'brew-cli-darwin-x64' },
  { target: 'bun-linux-x64', artifact: 'brew-cli-linux-x64' },
  { target: 'bun-linux-arm64', artifact: 'brew-cli-linux-arm64' },
  { target: 'bun-windows-x64', artifact: 'brew-cli-windows-x64.exe' },
] as const

const root = join(import.meta.dirname, '..')
const outDir = join(root, 'dist-bin')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  version: string
}

mkdirSync(outDir, { recursive: true })

const checksums: string[] = []
for (const { target, artifact } of TARGETS) {
  const outfile = join(outDir, artifact)
  const proc = spawnSync(
    'bun',
    [
      'build',
      'src/bin.ts',
      '--compile',
      `--target=${target}`,
      `--outfile=${outfile}`,
      '--define',
      `__CLI_VERSION__=${JSON.stringify(pkg.version)}`,
    ],
    { cwd: root, stdio: 'inherit' }
  )
  if (proc.status !== 0) {
    console.error(`build failed for ${target}`)
    process.exit(1)
  }
  const digest = createHash('sha256')
    .update(readFileSync(outfile))
    .digest('hex')
  checksums.push(`${digest}  ${artifact}`)
  console.log(`built ${artifact}`)
}

writeFileSync(join(outDir, 'checksums.txt'), `${checksums.join('\n')}\n`)
console.log('wrote checksums.txt')
