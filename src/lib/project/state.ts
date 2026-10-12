import { join } from 'node:path'
import { readTextFile, stripBom } from './fs-writer'

/**
 * `brew.json`: the project file `init` writes and commits, so re-running it
 * is a no-op and teammates' runs agree. It holds identifiers and hashes,
 * never secrets. Validated by hand (no schema library: the CLI ships with
 * no runtime dependencies beyond the SDK and commander) and written with a
 * stable key order, so a re-run that changes nothing produces no diff.
 */

export const BREW_STATE_FILE = 'brew.json'

/** The JSON Schema shipped in this package (`schemas/brew.json`). */
export const BREW_STATE_SCHEMA_URL =
  'https://unpkg.com/@brew.new/cli/schemas/brew.json'

export const BREW_STATE_VERSION = 1

/** The platform's trigger-key grammar (shared contract). */
export const TRIGGER_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHA256_PATTERN = /^[0-9a-f]{64}$/

export type BrewProjectEmail = {
  readonly triggerEventId: string
  readonly automationId: string
}

export type BrewManagedFile = {
  /** sha256 (hex, LF-normalized) of the content the CLI last wrote. */
  readonly sha256: string
  /** What wrote it, e.g. `init@0.18.0:lib/brew.ts`. */
  readonly generator: string
}

export type BrewProjectState = {
  readonly $schema?: string
  readonly version: 1
  readonly projectId: string
  readonly brandId?: string
  readonly framework?: string
  readonly auth?: string
  readonly contractsPath?: string
  /** Trigger key → the trigger and automation that send it. */
  readonly emails: Readonly<Record<string, BrewProjectEmail>>
  /** Project-relative path → what the CLI wrote there. */
  readonly files: Readonly<Record<string, BrewManagedFile>>
  /** Provider settings saved before changing them, for rollback. */
  readonly providerConfig?: Readonly<Record<string, unknown>>
  /** MCP clients configured for this project. */
  readonly mcp?: readonly string[]
}

/** Top-level keys this CLI does not know, kept verbatim on rewrite. */
export type BrewStateExtra = Readonly<Record<string, unknown>>

export type ParsedBrewState =
  | {
      readonly ok: true
      readonly state: BrewProjectState
      readonly extra: BrewStateExtra
    }
  | { readonly ok: false; readonly errors: readonly string[] }

export class BrewStateError extends Error {
  readonly errors: readonly string[]

  constructor(path: string, errors: readonly string[]) {
    super(`${path} is not a valid brew.json: ${errors.join('; ')}`)
    this.name = 'BrewStateError'
    this.errors = errors
  }
}

const KNOWN_KEYS = [
  '$schema',
  'version',
  'projectId',
  'brandId',
  'framework',
  'auth',
  'contractsPath',
  'emails',
  'files',
  'providerConfig',
  'mcp',
] as const

export function createBrewState(
  input: Partial<Omit<BrewProjectState, 'version'>> = {}
): BrewProjectState {
  return {
    $schema: BREW_STATE_SCHEMA_URL,
    ...input,
    version: BREW_STATE_VERSION,
    projectId: input.projectId ?? crypto.randomUUID(),
    emails: input.emails ?? {},
    files: input.files ?? {},
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A project-relative POSIX path that stays inside the project. */
export function isSafeRelativePath(path: string): boolean {
  return (
    path !== '' &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !/^[A-Za-z]:/.test(path) &&
    !path.split('/').some((segment) => segment === '..' || segment === '')
  )
}

export function validateBrewState(value: unknown): ParsedBrewState {
  if (!isRecord(value)) {
    return { ok: false, errors: ['the top level must be an object'] }
  }
  const errors: string[] = []
  const optionalString = (key: string): void => {
    const field = value[key]
    if (field !== undefined && (typeof field !== 'string' || field === '')) {
      errors.push(`${key} must be a non-empty string`)
    }
  }
  if (value.version !== BREW_STATE_VERSION) {
    errors.push(
      `version must be ${BREW_STATE_VERSION} (got ${JSON.stringify(value.version)}); a newer CLI may have written this file`
    )
  }
  if (
    typeof value.projectId !== 'string' ||
    !UUID_PATTERN.test(value.projectId)
  ) {
    errors.push('projectId must be a UUID')
  }
  for (const key of ['$schema', 'brandId', 'framework', 'auth']) {
    optionalString(key)
  }
  if (
    value.contractsPath !== undefined &&
    (typeof value.contractsPath !== 'string' ||
      !isSafeRelativePath(value.contractsPath))
  ) {
    errors.push('contractsPath must be a project-relative path')
  }
  if (!isRecord(value.emails)) {
    errors.push('emails must be an object')
  } else {
    for (const [key, entry] of Object.entries(value.emails)) {
      if (!TRIGGER_KEY_PATTERN.test(key)) {
        errors.push(`emails.${key}: not a valid trigger key`)
      }
      if (
        !isRecord(entry) ||
        typeof entry.triggerEventId !== 'string' ||
        entry.triggerEventId === '' ||
        typeof entry.automationId !== 'string' ||
        entry.automationId === ''
      ) {
        errors.push(
          `emails.${key} must be { triggerEventId: string, automationId: string }`
        )
      }
    }
  }
  if (!isRecord(value.files)) {
    errors.push('files must be an object')
  } else {
    for (const [path, entry] of Object.entries(value.files)) {
      if (!isSafeRelativePath(path)) {
        errors.push(`files.${path}: not a project-relative path`)
      }
      if (
        !isRecord(entry) ||
        typeof entry.sha256 !== 'string' ||
        !SHA256_PATTERN.test(entry.sha256) ||
        typeof entry.generator !== 'string' ||
        entry.generator === ''
      ) {
        errors.push(
          `files.${path} must be { sha256: <64 hex chars>, generator: string }`
        )
      }
    }
  }
  if (value.providerConfig !== undefined && !isRecord(value.providerConfig)) {
    errors.push('providerConfig must be an object')
  }
  if (
    value.mcp !== undefined &&
    (!Array.isArray(value.mcp) ||
      !value.mcp.every((id) => typeof id === 'string' && id !== ''))
  ) {
    errors.push('mcp must be an array of client ids')
  }
  if (errors.length > 0) {
    return { ok: false, errors }
  }
  const extra: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(value)) {
    if (!(KNOWN_KEYS as readonly string[]).includes(key)) {
      extra[key] = field
    }
  }
  return { ok: true, state: value as BrewProjectState, extra }
}

export function parseBrewState(text: string): ParsedBrewState {
  let value: unknown
  try {
    value = JSON.parse(stripBom(text))
  } catch (error) {
    return {
      ok: false,
      errors: [
        `not valid JSON (${error instanceof Error ? error.message : String(error)})`,
      ],
    }
  }
  return validateBrewState(value)
}

/**
 * The project's `brew.json`, or `null` when there is none. An invalid file
 * throws `BrewStateError`: commands must not silently replace it.
 */
export function readBrewState(
  root: string
): { readonly state: BrewProjectState; readonly extra: BrewStateExtra } | null {
  const path = join(root, BREW_STATE_FILE)
  const text = readTextFile(path)
  if (text === null) {
    return null
  }
  const parsed = parseBrewState(text)
  if (!parsed.ok) {
    throw new BrewStateError(path, parsed.errors)
  }
  return { state: parsed.state, extra: parsed.extra }
}

function sortedRecord<T>(
  record: Readonly<Record<string, T>>,
  map: (value: T) => unknown
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(record).sort()) {
    out[key] = map(record[key] as T)
  }
  return out
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep)
  }
  if (isRecord(value)) {
    return sortedRecord(value, sortDeep)
  }
  return value
}

/**
 * Stable text: known keys in schema order, map keys sorted, unknown keys
 * last (sorted), two-space indent, trailing newline.
 */
export function serializeBrewState(
  state: BrewProjectState,
  extra: BrewStateExtra = {}
): string {
  const out: Record<string, unknown> = {
    $schema: state.$schema ?? BREW_STATE_SCHEMA_URL,
    version: state.version,
    projectId: state.projectId,
  }
  if (state.brandId !== undefined) {
    out.brandId = state.brandId
  }
  if (state.framework !== undefined) {
    out.framework = state.framework
  }
  if (state.auth !== undefined) {
    out.auth = state.auth
  }
  if (state.contractsPath !== undefined) {
    out.contractsPath = state.contractsPath
  }
  out.emails = sortedRecord(state.emails, (entry) => ({
    triggerEventId: entry.triggerEventId,
    automationId: entry.automationId,
  }))
  out.files = sortedRecord(state.files, (entry) => ({
    sha256: entry.sha256,
    generator: entry.generator,
  }))
  if (state.providerConfig !== undefined) {
    out.providerConfig = sortDeep(state.providerConfig)
  }
  if (state.mcp !== undefined) {
    out.mcp = [...new Set(state.mcp)].sort()
  }
  for (const key of Object.keys(extra).sort()) {
    if (!(KNOWN_KEYS as readonly string[]).includes(key)) {
      out[key] = extra[key]
    }
  }
  return `${JSON.stringify(out, null, 2)}\n`
}
