import { createHash, randomBytes } from 'node:crypto'
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'
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
  /**
   * Not written: the path is a symbolic link a secret must not go through,
   * a dangling link, or one whose target leaves the allowed directory.
   */
  | 'refused'

export type PlannedChange = {
  /** The path as the caller named it (relative to the root, or absolute). */
  readonly path: string
  readonly action: ChangeAction
  /** sha256 of the content now on disk (or that would be), LF-normalized. */
  readonly sha256?: string
  /** Unified diff of a change that writes (dry-run previews and reports). */
  readonly diff?: string
  /** Why a file was left alone, or what else changed about it. */
  readonly note?: string
  /**
   * An unchanged file whose permissions were (or would be) tightened to
   * the requested mode: octal strings, e.g. `{ from: '0644', to: '0600' }`.
   */
  readonly permissions?: { readonly from: string; readonly to: string }
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

/** A UTF-8 byte order mark some Windows editors put at the start of a file. */
export const UTF8_BOM = '\uFEFF'

/** `text` without a leading byte order mark (`JSON.parse` rejects one). */
export function stripBom(text: string): string {
  return text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text
}

/** A write the CLI refuses: where it would land is not the CLI's to write. */
export class UnsafeWriteTargetError extends Error {
  readonly path: string
  readonly reason: string

  constructor(path: string, reason: string) {
    super(`Refusing to write ${path}: ${reason}.`)
    this.name = 'UnsafeWriteTargetError'
    this.path = path
    this.reason = reason
  }
}

export type WriteTargetOptions = {
  /**
   * The directory the write must land in once every symbolic link (the
   * file's and its parent directories') is resolved. Absent: no check.
   */
  readonly within?: string
  /** A secret (`.env.local`): never written through a symbolic link. */
  readonly sensitive?: boolean
}

function isInside(path: string, dir: string): boolean {
  const rel = relative(dir, path)
  return (
    rel === '' ||
    (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  )
}

/**
 * `path` with the symbolic links of its existing part resolved (the part
 * that does not exist yet is appended as named). `null` when a component
 * is a dangling link: where the write would land cannot be known.
 */
function realLocation(path: string): string | null {
  const missing: string[] = []
  let current = resolve(path)
  for (;;) {
    try {
      return join(realpathSync(current), ...missing.reverse())
    } catch {
      try {
        lstatSync(current)
        return null
      } catch {
        // Does not exist: resolve its parent.
      }
      const parent = dirname(current)
      if (parent === current) {
        return resolve(path)
      }
      missing.push(basename(current))
      current = parent
    }
  }
}

/**
 * The file a write to `path` must land in. A symbolic link (a config kept
 * in a dotfiles directory) is followed to its target, so the rename
 * replaces the target's content and the link survives. Throws
 * `UnsafeWriteTargetError` instead of writing when the path is a link and
 * the content is a secret, when the link dangles, or when the real
 * location (links in parent directories included) leaves `within`.
 */
export function resolveWriteTarget(
  path: string,
  options: WriteTargetOptions = {}
): string {
  let isLink = false
  try {
    isLink = lstatSync(path).isSymbolicLink()
  } catch {
    isLink = false
  }
  if (isLink && options.sensitive === true) {
    throw new UnsafeWriteTargetError(
      path,
      'it is a symbolic link, and a secret is never written through one'
    )
  }
  let target = path
  if (isLink) {
    try {
      target = realpathSync(path)
    } catch {
      throw new UnsafeWriteTargetError(
        path,
        'it is a symbolic link to a file that does not exist'
      )
    }
  }
  if (options.within !== undefined) {
    const real = realLocation(target)
    if (real === null) {
      throw new UnsafeWriteTargetError(
        path,
        'a directory on its path is a symbolic link to nothing'
      )
    }
    const base = realLocation(options.within) ?? resolve(options.within)
    if (!isInside(real, base)) {
      throw new UnsafeWriteTargetError(
        path,
        `it resolves to ${real}, outside ${options.within}`
      )
    }
  }
  return target
}

/**
 * Writes `content` to `path` atomically: a temp file beside it, then a
 * rename, so a crash or Ctrl-C never leaves a half-written config. `mode`
 * applies to the new file (0o600 for secrets); without it an existing
 * file keeps its mode. A symbolic link is written through, never replaced,
 * within the limits of `resolveWriteTarget`.
 */
export function writeFileAtomic(
  linkOrPath: string,
  content: string,
  options: WriteTargetOptions & { readonly mode?: number } = {}
): void {
  const path = resolveWriteTarget(linkOrPath, options)
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
  /**
   * File mode for a created (or rewritten) file, e.g. 0o600. An existing
   * file that stays unchanged loses any permission bit outside it.
   */
  readonly mode?: number
  /**
   * sha256 of what the CLI last wrote here (from `brew.json#files`). When
   * the file on disk still hashes to it, nobody edited it since, so the CLI
   * may replace it. Any other content is the user's: kept.
   */
  readonly managedSha256?: string
  /**
   * The content is secret (`.env.local`): the change carries no diff, so a
   * dry-run plan or report can never print a value, and the file is never
   * written through a symbolic link (`refused`).
   */
  readonly sensitive?: boolean
  /**
   * The directory the write must land in, symbolic links resolved
   * (default: the project root). A user-scope config passes the home
   * directory, so a link into `~/dotfiles` still works.
   */
  readonly within?: string
  /**
   * Replace whatever is there. Only for files whose new content the caller
   * derived FROM the current content (a JSON merge), so nothing is lost.
   */
  readonly overwrite?: boolean
}

export type UpsertBlockOptions = {
  readonly markers?: BlockMarkers
  readonly mode?: number
  /** As `WriteFileOptions.sensitive`: no diff, never through a link. */
  readonly sensitive?: boolean
  /** As `WriteFileOptions.within`. */
  readonly within?: string
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
    const guard = this.#guard(absolute, path, options)
    if (guard !== null) {
      return this.#record(guard)
    }
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
        sensitive: options.sensitive === true,
        within: this.#within(options),
      })
    }
    if (normalizeEol(existing) === normalizeEol(content)) {
      return this.#record({
        path,
        action: 'unchanged',
        sha256,
        ...this.#tighten(absolute, options.mode),
      })
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
      sensitive: options.sensitive === true,
      within: this.#within(options),
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
    const guard = this.#guard(absolute, path, options)
    if (guard !== null) {
      return this.#record(guard)
    }
    const existing = readTextFile(absolute)
    const sensitive = options.sensitive === true
    const within = this.#within(options)
    if (existing === null) {
      if (options.createIfMissing === false) {
        return this.#record({ path, action: 'missing' })
      }
      const created = applyBlock('', content, markers)
      if (created === 'unbalanced') {
        throw new Error('unreachable: an empty file has no markers')
      }
      return this.#commit(absolute, {
        path,
        action: 'created',
        sha256: sha256Hex(created),
        content: created,
        before: '',
        mode: options.mode,
        sensitive,
        within,
      })
    }
    const next = applyBlock(existing, content, markers)
    if (next === 'unbalanced') {
      return this.#record({
        path,
        action: 'kept-user-version',
        sha256: sha256Hex(existing),
        note: `unbalanced ${markers.start} / ${markers.end} markers`,
      })
    }
    if (next === normalizeEol(existing)) {
      return this.#record({
        path,
        action: 'unchanged',
        sha256: sha256Hex(existing),
        ...this.#tighten(absolute, options.mode),
      })
    }
    const crlf = usesCrlf(existing)
    return this.#commit(absolute, {
      path,
      action: 'updated',
      sha256: sha256Hex(next),
      content: withEol(next, crlf),
      before: existing,
      mode: options.mode,
      sensitive,
      within,
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

  #within(options: { readonly within?: string }): string {
    return options.within ?? this.root
  }

  /** A `refused` change when the write must not happen, else `null`. */
  #guard(
    absolute: string,
    path: string,
    options: { readonly within?: string; readonly sensitive?: boolean }
  ): PlannedChange | null {
    try {
      resolveWriteTarget(absolute, {
        within: this.#within(options),
        sensitive: options.sensitive === true,
      })
      return null
    } catch (error) {
      if (!(error instanceof UnsafeWriteTargetError)) {
        throw error
      }
      return { path, action: 'refused', note: error.reason }
    }
  }

  /**
   * Drops the permission bits of an existing file that `mode` does not
   * grant (0644 → 0600 for a secret). Never loosens; dry runs only report.
   */
  #tighten(
    absolute: string,
    mode: number | undefined
  ): Pick<PlannedChange, 'permissions' | 'note'> {
    if (mode === undefined) {
      return {}
    }
    let current: number
    try {
      current = statSync(absolute).mode & 0o777
    } catch {
      return {}
    }
    const next = current & mode
    if (next === current) {
      return {}
    }
    if (!this.dryRun) {
      chmodSync(absolute, next)
    }
    const permissions = { from: octalMode(current), to: octalMode(next) }
    return {
      permissions,
      note: `permissions tightened from ${permissions.from} to ${permissions.to}`,
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
      readonly sensitive: boolean
      readonly within: string
    }
  ): PlannedChange {
    if (!this.dryRun) {
      writeFileAtomic(absolute, input.content, {
        within: input.within,
        sensitive: input.sensitive,
        ...(input.mode === undefined ? {} : { mode: input.mode }),
      })
    }
    return this.#record({
      path: input.path,
      action: input.action,
      sha256: input.sha256,
      ...(input.sensitive
        ? {}
        : {
            diff: unifiedDiff(input.before, input.content, {
              fromPath: input.path,
            }),
          }),
    })
  }
}

function octalMode(mode: number): string {
  return `0${mode.toString(8).padStart(3, '0')}`
}

/**
 * `text` (LF-normalized) with its marked block set to `content`: replaced
 * in place, or appended after a blank line when the text has none.
 * `'unbalanced'` when the markers do not pair up exactly once.
 */
export function applyBlock(
  text: string,
  content: string,
  markers: BlockMarkers = HTML_BLOCK_MARKERS
): string | 'unbalanced' {
  const normalized = normalizeEol(text)
  const body = normalizeEol(content).replace(/\n+$/, '')
  const block = `${markers.start}\n${body}\n${markers.end}`
  const located = locateBlock(normalized, markers)
  if (located === 'unbalanced') {
    return located
  }
  if (located !== null) {
    return `${normalized.slice(0, located.start)}${block}${normalized.slice(located.end)}`
  }
  const separator =
    normalized === '' || normalized.endsWith('\n\n')
      ? ''
      : normalized.endsWith('\n')
        ? '\n'
        : '\n\n'
  return `${normalized}${separator}${block}\n`
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
