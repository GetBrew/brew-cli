import { createHash, randomBytes } from 'node:crypto'
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { unifiedDiff } from './diff'

/**
 * Every file a project command touches goes through a `ProjectWriter`:
 *
 * - files are create-only unless the caller proves the current content is
 *   the CLI's own (a recorded sha256 of what it last wrote) or asks to
 *   overwrite a file it merged itself;
 * - shared files (AGENTS.md, .gitignore) are edited only inside a marked
 *   block (`upsertBlock`), never outside it;
 * - every write is atomic (temp file + rename in the same directory);
 * - in dry-run mode nothing is written and the same calls return the plan.
 *
 * The writer never throws for a file it decides not to touch: the decision
 * is the change's `action`, so a dry run and a real run report alike.
 */

export type ChangeAction =
  /** The file did not exist and was (or would be) written. */
  | 'created'
  /** The file existed and was (or would be) rewritten. */
  | 'updated'
  /** The file already has exactly this content. */
  | 'unchanged'
  /** The file differs and is not the CLI's to replace: left as it is. */
  | 'kept-user-version'
  /** The file does not exist and was not created (inspection, opt-out). */
  | 'missing'

export type PlannedChange = {
  /** The path as the caller named it (relative to the root, or absolute). */
  readonly path: string
  readonly action: ChangeAction
  /** sha256 of the content now on disk (or that would be), LF-normalized. */
  readonly sha256?: string
  /** Unified diff of a change that writes (dry-run previews and reports). */
  readonly diff?: string
  /** Why a file was left alone. */
  readonly note?: string
}

export type BlockMarkers = { readonly start: string; readonly end: string }

/** Markers for Markdown (AGENTS.md, CLAUDE.md). */
export const HTML_BLOCK_MARKERS: BlockMarkers = {
  start: '<!-- brew:start -->',
  end: '<!-- brew:end -->',
}

/** Markers for `#`-comment files (.gitignore, .env, YAML, TOML). */
export const HASH_BLOCK_MARKERS: BlockMarkers = {
  start: '# brew:start',
  end: '# brew:end',
}

/** Line endings are a checkout detail (autocrlf): hashes ignore them. */
export function normalizeEol(text: string): string {
  return text.replaceAll('\r\n', '\n')
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(normalizeEol(text), 'utf8').digest('hex')
}

function usesCrlf(text: string): boolean {
  return text.includes('\r\n')
}

function withEol(text: string, crlf: boolean): string {
  const lf = normalizeEol(text)
  return crlf ? lf.replaceAll('\n', '\r\n') : lf
}

/** Reads a UTF-8 file, or `null` when it does not exist. */
export function readTextFile(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

/**
 * Writes `content` to `path` atomically: a temp file beside it, then a
 * rename, so a crash or Ctrl-C never leaves a half-written config. `mode`
 * applies to the new file (0o600 for secrets); without it an existing
 * file keeps its mode.
 */
export function writeFileAtomic(
  path: string,
  content: string,
  options: { readonly mode?: number } = {}
): void {
  mkdirSync(dirname(path), { recursive: true })
  let mode = options.mode
  if (mode === undefined) {
    try {
      mode = statSync(path).mode & 0o777
    } catch {
      mode = undefined
    }
  }
  const tmp = `${path}.brew-tmp-${process.pid}-${randomBytes(4).toString('hex')}`
  try {
    writeFileSync(tmp, content, {
      encoding: 'utf8',
      ...(mode === undefined ? {} : { mode }),
    })
    if (mode !== undefined) {
      chmodSync(tmp, mode)
    }
    renameSync(tmp, path)
  } catch (error) {
    rmSync(tmp, { force: true })
    throw error
  }
}

export type WriteFileOptions = {
  /** File mode for a created (or rewritten) file, e.g. 0o600. */
  readonly mode?: number
  /**
   * sha256 of what the CLI last wrote here (from `brew.json#files`). When
   * the file on disk still hashes to it, nobody edited it since, so the CLI
   * may replace it. Any other content is the user's: kept.
   */
  readonly managedSha256?: string
  /**
   * Replace whatever is there. Only for files whose new content the caller
   * derived FROM the current content (a JSON merge), so nothing is lost.
   */
  readonly overwrite?: boolean
}

export type UpsertBlockOptions = {
  readonly markers?: BlockMarkers
  readonly mode?: number
  /** Create the file when it does not exist (default true). */
  readonly createIfMissing?: boolean
}

export class ProjectWriter {
  readonly root: string
  readonly dryRun: boolean
  readonly #changes: PlannedChange[] = []

  constructor(options: { readonly root: string; readonly dryRun?: boolean }) {
    this.root = resolve(options.root)
    this.dryRun = options.dryRun === true
  }

  /** Every change planned (dry run) or made so far, in call order. */
  get changes(): readonly PlannedChange[] {
    return this.#changes
  }

  /**
   * Absolute location of a path. Relative paths must stay inside the root:
   * `../x` is a programming error, never a user's file.
   */
  resolvePath(path: string): string {
    if (isAbsolute(path)) {
      return path
    }
    const absolute = resolve(this.root, path)
    const rel = relative(this.root, absolute)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error(`Refusing to write outside the project root: ${path}`)
    }
    return absolute
  }

  read(path: string): string | null {
    return readTextFile(this.resolvePath(path))
  }

  /**
   * A create-only file (see `WriteFileOptions` for the two ways an existing
   * file may still be replaced). An existing file with the same content
   * (line endings aside) is `unchanged` and is not rewritten.
   */
  writeFile(
    path: string,
    content: string,
    options: WriteFileOptions = {}
  ): PlannedChange {
    const absolute = this.resolvePath(path)
    const existing = readTextFile(absolute)
    const sha256 = sha256Hex(content)
    if (existing === null) {
      return this.#commit(absolute, {
        path,
        action: 'created',
        sha256,
        content,
        before: '',
        mode: options.mode,
      })
    }
    if (normalizeEol(existing) === normalizeEol(content)) {
      return this.#record({ path, action: 'unchanged', sha256 })
    }
    const isOurs =
      options.overwrite === true ||
      (options.managedSha256 !== undefined &&
        sha256Hex(existing) === options.managedSha256)
    if (!isOurs) {
      return this.#record({
        path,
        action: 'kept-user-version',
        sha256: sha256Hex(existing),
        note:
          options.managedSha256 === undefined
            ? 'exists with different content'
            : 'edited since the CLI wrote it',
      })
    }
    return this.#commit(absolute, {
      path,
      action: 'updated',
      sha256,
      content: withEol(content, usesCrlf(existing)),
      before: existing,
      mode: options.mode,
    })
  }

  /**
   * Replaces the text between `markers` (or appends a marked block when the
   * file has none), leaving every byte outside the block alone. The file's
   * own line endings are kept. Unbalanced markers (a start without an end,
   * duplicates) are the user's edit: the file is kept as is.
   */
  upsertBlock(
    path: string,
    content: string,
    options: UpsertBlockOptions = {}
  ): PlannedChange {
    const markers = options.markers ?? HTML_BLOCK_MARKERS
    const absolute = this.resolvePath(path)
    const existing = readTextFile(absolute)
    const body = normalizeEol(content).replace(/\n+$/, '')
    const block = `${markers.start}\n${body}\n${markers.end}`
    if (existing === null) {
      if (options.createIfMissing === false) {
        return this.#record({ path, action: 'missing' })
      }
      const created = `${block}\n`
      return this.#commit(absolute, {
        path,
        action: 'created',
        sha256: sha256Hex(created),
        content: created,
        before: '',
        mode: options.mode,
      })
    }
    const crlf = usesCrlf(existing)
    const text = normalizeEol(existing)
    const located = locateBlock(text, markers)
    if (located === 'unbalanced') {
      return this.#record({
        path,
        action: 'kept-user-version',
        sha256: sha256Hex(existing),
        note: `unbalanced ${markers.start} / ${markers.end} markers`,
      })
    }
    let next: string
    if (located === null) {
      const separator =
        text === ''
          ? ''
          : text.endsWith('\n\n')
            ? ''
            : text.endsWith('\n')
              ? '\n'
              : '\n\n'
      next = `${text}${separator}${block}\n`
    } else {
      next = `${text.slice(0, located.start)}${block}${text.slice(located.end)}`
    }
    if (next === text) {
      return this.#record({
        path,
        action: 'unchanged',
        sha256: sha256Hex(existing),
      })
    }
    return this.#commit(absolute, {
      path,
      action: 'updated',
      sha256: sha256Hex(next),
      content: withEol(next, crlf),
      before: existing,
      mode: options.mode,
    })
  }

  /**
   * Where a file the CLI wrote earlier stands now, without writing:
   * `unchanged` (still the recorded hash), `kept-user-version` (edited
   * since) or `missing` (deleted).
   */
  inspectManaged(path: string, recordedSha256: string): PlannedChange {
    const existing = this.read(path)
    if (existing === null) {
      return { path, action: 'missing' }
    }
    const sha256 = sha256Hex(existing)
    return sha256 === recordedSha256
      ? { path, action: 'unchanged', sha256 }
      : {
          path,
          action: 'kept-user-version',
          sha256,
          note: 'edited since the CLI wrote it',
        }
  }

  #record(change: PlannedChange): PlannedChange {
    this.#changes.push(change)
    return change
  }

  #commit(
    absolute: string,
    input: {
      readonly path: string
      readonly action: 'created' | 'updated'
      readonly sha256: string
      readonly content: string
      readonly before: string
      readonly mode: number | undefined
    }
  ): PlannedChange {
    if (!this.dryRun) {
      writeFileAtomic(
        absolute,
        input.content,
        input.mode === undefined ? {} : { mode: input.mode }
      )
    }
    return this.#record({
      path: input.path,
      action: input.action,
      sha256: input.sha256,
      diff: unifiedDiff(input.before, input.content, {
        fromPath: input.path,
      }),
    })
  }
}

/**
 * The block's span (from its start marker through its end marker) in
 * LF-normalized text: `null` when there is none, `'unbalanced'` when the
 * markers do not pair up exactly once. Markers match whole lines only.
 */
function locateBlock(
  text: string,
  markers: BlockMarkers
): { readonly start: number; readonly end: number } | null | 'unbalanced' {
  const starts: number[] = []
  const ends: number[] = []
  let offset = 0
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === markers.start) {
      starts.push(offset)
    } else if (trimmed === markers.end) {
      ends.push(offset + line.length)
    }
    offset += line.length + 1
  }
  if (starts.length === 0 && ends.length === 0) {
    return null
  }
  const [start] = starts
  const [end] = ends
  if (
    starts.length !== 1 ||
    ends.length !== 1 ||
    start === undefined ||
    end === undefined ||
    end < start
  ) {
    return 'unbalanced'
  }
  return { start, end }
}

/** The text between a file's markers, or `null` when it has no block. */
export function readBlock(
  text: string,
  markers: BlockMarkers = HTML_BLOCK_MARKERS
): string | null {
  const normalized = normalizeEol(text)
  const located = locateBlock(normalized, markers)
  if (located === null || located === 'unbalanced') {
    return null
  }
  const lines = normalized.split('\n')
  const first = lines.findIndex((line) => line.trim() === markers.start)
  const last = lines.findIndex((line) => line.trim() === markers.end)
  return lines.slice(first + 1, last).join('\n')
}
