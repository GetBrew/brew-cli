import { join } from 'node:path'
import type { SpawnFn } from '../types'
import {
  HASH_BLOCK_MARKERS,
  type PlannedChange,
  type ProjectWriter,
  readBlock,
  readTextFile,
} from './fs-writer'
import { defaultSpawn } from './process'

/**
 * Whether git would ignore a path, so a secrets file is never left one
 * `git add .` away from a commit. Git itself answers (`git check-ignore`
 * honours every .gitignore, `.git/info/exclude` and the global excludes
 * file); outside a repository, or without git, a small parser reads the
 * root `.gitignore`.
 */
export async function isIgnored(
  path: string,
  options: {
    /** The project root the path is relative to. */
    readonly cwd: string
    readonly spawn?: SpawnFn
    readonly signal?: AbortSignal
  }
): Promise<boolean> {
  const spawn = options.spawn ?? defaultSpawn
  try {
    const result = await spawn('git', ['check-ignore', '-q', '--', path], {
      cwd: options.cwd,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    })
    if (result.code === 0) {
      return true
    }
    if (result.code === 1) {
      return false
    }
    // 128: not a repository (or another fatal error) → read the file.
  } catch {
    options.signal?.throwIfAborted()
    // git is not installed (ENOENT) → read the file.
  }
  const text = readTextFile(join(options.cwd, '.gitignore'))
  return text === null ? false : matchesGitignore(text, path)
}

type Rule = {
  readonly negate: boolean
  readonly dirOnly: boolean
  readonly regex: RegExp
}

function globToRegex(glob: string): string {
  let out = ''
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index] ?? ''
    if (char === '*') {
      if (glob[index + 1] === '*') {
        const before = index === 0 || glob[index - 1] === '/'
        const after = glob[index + 2]
        if (before && after === '/') {
          out += '(?:.*/)?'
          index += 2
          continue
        }
        if (before && after === undefined) {
          out += '.*'
          index += 1
          continue
        }
      }
      out += '[^/]*'
    } else if (char === '?') {
      out += '[^/]'
    } else if (char === '[') {
      const close = glob.indexOf(']', index + 2)
      if (close === -1) {
        out += '\\['
        continue
      }
      let body = glob.slice(index + 1, close)
      if (body.startsWith('!')) {
        body = `^${body.slice(1)}`
      }
      out += `[${body.replaceAll('\\', '\\\\')}]`
      index = close
    } else if (char === '\\' && index + 1 < glob.length) {
      index += 1
      out += (glob[index] ?? '').replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
    } else {
      out += char.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
    }
  }
  return out
}

function parseRules(text: string): Rule[] {
  const rules: Rule[] = []
  for (const rawLine of text.replaceAll('\r\n', '\n').split('\n')) {
    let line = rawLine.replace(/(?<!\\)\s+$/, '')
    if (line === '' || line.startsWith('#')) {
      continue
    }
    let negate = false
    if (line.startsWith('!')) {
      negate = true
      line = line.slice(1)
    } else if (line.startsWith('\\!') || line.startsWith('\\#')) {
      line = line.slice(1)
    }
    let dirOnly = false
    if (line.endsWith('/')) {
      dirOnly = true
      line = line.replace(/\/+$/, '')
    }
    if (line === '') {
      continue
    }
    const anchored = line.includes('/')
    if (line.startsWith('/')) {
      line = line.slice(1)
    }
    const body = globToRegex(line)
    rules.push({
      negate,
      dirOnly,
      regex: new RegExp(anchored ? `^${body}$` : `^(?:.*/)?${body}$`),
    })
  }
  return rules
}

function lastMatch(
  rules: readonly Rule[],
  path: string,
  isDir: boolean
): boolean | undefined {
  let ignored: boolean | undefined
  for (const rule of rules) {
    if (rule.dirOnly && !isDir) {
      continue
    }
    if (rule.regex.test(path)) {
      ignored = !rule.negate
    }
  }
  return ignored
}

/**
 * gitignore semantics for one root-level file: last matching rule wins, a
 * trailing `/` matches directories only, a pattern with a `/` is anchored
 * to the root, and nothing inside an ignored directory can be re-included.
 * `path` is root-relative; a trailing `/` marks a directory.
 */
export function matchesGitignore(text: string, path: string): boolean {
  const rules = parseRules(text)
  const isDir = path.endsWith('/')
  const segments = path
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .split('/')
    .filter((segment) => segment !== '')
  for (let depth = 1; depth < segments.length; depth += 1) {
    if (lastMatch(rules, segments.slice(0, depth).join('/'), true) === true) {
      return true
    }
  }
  return lastMatch(rules, segments.join('/'), isDir) === true
}

/**
 * Adds every path git would not ignore to a `# brew:start` / `# brew:end`
 * block in the root `.gitignore` (created when missing). Lines outside
 * the block are never touched. Returns what it added, and the change when
 * it had to write.
 */
export async function ensureIgnored(
  writer: ProjectWriter,
  paths: readonly string[],
  options: { readonly spawn?: SpawnFn; readonly signal?: AbortSignal } = {}
): Promise<{
  readonly added: readonly string[]
  readonly change?: PlannedChange
}> {
  const added: string[] = []
  for (const path of paths) {
    const ignored = await isIgnored(path, {
      cwd: writer.root,
      ...(options.spawn === undefined ? {} : { spawn: options.spawn }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    })
    if (!ignored) {
      added.push(path)
    }
  }
  if (added.length === 0) {
    return { added }
  }
  const current = writer.read('.gitignore')
  const existing =
    current === null
      ? []
      : (readBlock(current, HASH_BLOCK_MARKERS) ?? '').split('\n')
  const lines = [
    ...existing.filter((line) => line.trim() !== ''),
    ...added.filter((path) => !existing.includes(path)),
  ]
  const change = writer.upsertBlock('.gitignore', lines.join('\n'), {
    markers: HASH_BLOCK_MARKERS,
  })
  return { added, change }
}
