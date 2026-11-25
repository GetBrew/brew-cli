import { execFileSync } from 'node:child_process'
import { lstatSync, readFileSync } from 'node:fs'
import { findComments } from './lib/source-comments.mjs'

const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
)
  .split('\0')
  .filter(Boolean)
const failures = []
let checked = 0
for (const file of new Set(files)) {
  if (!/\.(?:[cm]?[jt]sx?|jsonc)$/.test(file)) continue
  if (
    /^(?:\.agents\/|\.claude\/)/.test(file) ||
    /(?:^|\/)(?:fixtures|__fixtures__|_generated|generated|__generated__)\//.test(
      file
    ) ||
    /\.generated\./.test(file) ||
    file === 'convex/migrations.ts' ||
    /(?:^|\/)next-env\.d\.ts$/.test(file)
  ) {
    continue
  }
  let source
  try {
    if (!lstatSync(file).isFile()) continue
    source = readFileSync(file, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') continue
    throw error
  }
  checked++
  for (const range of findComments(file, source)) {
    const line = source.slice(0, range.pos).split('\n').length
    failures.push(`${file}:${line}: remove explanatory source comment`)
  }
}
if (failures.length) {
  console.error(failures.slice(0, 100).join('\n'))
  console.error(`${failures.length} explanatory comments found.`)
  process.exitCode = 1
} else {
  console.log(
    `Source comments: ${checked} files checked; no explanatory comments.`
  )
}
