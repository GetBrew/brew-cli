import { cpSync, mkdirSync, mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const FIXTURES = join(import.meta.dirname, '../fixtures/projects')

/**
 * A fresh temp directory, bounded by an empty `.git` so walks up from it
 * stop there (and never reach a real repository or home directory).
 * Realpath'd: macOS tmpdir is a symlink, and paths are compared verbatim.
 */
export function tempProject(prefix = 'brew-cli-project-'): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  mkdirSync(join(dir, '.git'))
  return dir
}

/** A copy of `tests/fixtures/projects/<name>` in a bounded temp directory. */
export function copyFixture(name: string): string {
  const dir = tempProject(`brew-cli-${name}-`)
  cpSync(join(FIXTURES, name), dir, { recursive: true })
  return dir
}
