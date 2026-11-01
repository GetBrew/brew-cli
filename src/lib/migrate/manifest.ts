import { createHash, randomUUID } from 'node:crypto'
import { dirname } from 'node:path'
import { readTextFile, stripBom, writeFileAtomic } from '../project/fs-writer'

/**
 * `brew.migration.json`: what a migration planned and did, item by item,
 * with the Brew ids it created and the cursors that let an interrupted
 * apply resume. It is safe to commit and to show an agent: it never holds
 * a contact's address or name, a key, or a token.
 */

export const MIGRATION_MANIFEST_FILE = 'brew.migration.json'
export const MIGRATION_SCHEMA_VERSION = 1

/** Phases in the order a migration runs them. */
export const PHASES = [
  'domains',
  'templates',
  'code',
  'contacts',
  'segments',
  'suppressions',
  'topics',
  'broadcasts',
  'webhooks',
  'automations',
] as const

export type PhaseId = (typeof PHASES)[number]

export type ItemStatus = 'planned' | 'done' | 'failed' | 'skipped' | 'manual'

export type PhaseStatus = ItemStatus | 'partial'

export type ItemKind =
  | 'domain'
  | 'template'
  | 'react-email'
  | 'rewrite'
  | 'segment'
  | 'topic'
  | 'broadcast'
  | 'webhook'
  | 'automation'

export type MigrationWarning = {
  readonly code: string
  readonly message: string
}

export type MigrationItem = {
  /** Stable across runs: `template:<resendId>`, `react-email:<file>`, … */
  readonly id: string
  readonly kind: ItemKind
  status: ItemStatus
  readonly name: string
  readonly sourceId?: string
  readonly file?: string
  readonly alias?: string
  key?: string
  detail?: string
  brew?: {
    triggerEventId?: string
    automationId?: string
    emailId?: string
    published?: boolean
    audienceId?: string
    fieldName?: string
    audienceName?: string
    /** The key a setup was sent for: Brew may have it even with no answer. */
    setUpKey?: string
  }
  warnings?: MigrationWarning[]
  error?: { code: string; message: string }
  /** Resume cursor for an item read page by page (a segment's members). */
  cursor?: string | null
  counts?: Record<string, number>
}

export type PhaseState = {
  status: PhaseStatus
  detail?: string
  items: MigrationItem[]
  /** Resume cursor of a phase read page by page (contacts, suppressions). */
  cursor?: string | null
  counts?: Record<string, number>
  warnings?: MigrationWarning[]
  error?: { code: string; message: string }
}

export type CallSiteRecord = {
  readonly file: string
  readonly line: number
  readonly column: number
  readonly method: 'emails.send' | 'batch.send'
  readonly kind: string
  /** The client the call goes through (`src/lib/resend.ts#resend`). */
  readonly client: string | null
  readonly templateIds: readonly string[]
  key: string | null
  readonly component: string | null
  /** Fields that do not carry over (`attachments`, `cc`, raw `html`, …). */
  readonly unsupported: readonly string[]
  replacement: string
  status: ItemStatus
  note?: string
}

export type MigrationManifest = {
  readonly schemaVersion: 1
  readonly source: 'resend'
  readonly migrationId: string
  readonly createdAt: string
  updatedAt: string
  brandId: string | null
  /** A salted hash of the Resend key the account was read with (never the key). */
  sourceKeyHash?: string
  options: { keyPrefix: string; domain: string | null }
  phases: Partial<Record<PhaseId, PhaseState>>
  callSites: CallSiteRecord[]
  /** Files the migration wrote, with the sha256 it last wrote (the map, rewritten sources). */
  files: Record<string, { sha256: string }>
}

export class MigrationManifestError extends Error {}

export function createManifest(input: {
  readonly now: string
  readonly keyPrefix: string
}): MigrationManifest {
  return {
    schemaVersion: MIGRATION_SCHEMA_VERSION,
    source: 'resend',
    migrationId: randomUUID(),
    createdAt: input.now,
    updatedAt: input.now,
    brandId: null,
    options: { keyPrefix: input.keyPrefix, domain: null },
    phases: {},
    callSites: [],
    files: {},
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The manifest at `path`, or null when there is none. Throws on a broken one. */
export function readManifest(path: string): MigrationManifest | null {
  const text = readTextFile(path)
  if (text === null) {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(stripBom(text))
  } catch {
    throw new MigrationManifestError(`${path} is not valid JSON`)
  }
  if (!isRecord(parsed)) {
    throw new MigrationManifestError(`${path} is not a JSON object`)
  }
  if (parsed.schemaVersion !== MIGRATION_SCHEMA_VERSION) {
    throw new MigrationManifestError(
      `${path} has schemaVersion ${String(parsed.schemaVersion)}; this CLI reads ${MIGRATION_SCHEMA_VERSION}`
    )
  }
  if (parsed.source !== 'resend') {
    throw new MigrationManifestError(
      `${path} records a migration from ${String(parsed.source)}, not Resend`
    )
  }
  if (
    typeof parsed.migrationId !== 'string' ||
    !isRecord(parsed.phases) ||
    !Array.isArray(parsed.callSites) ||
    !isRecord(parsed.options)
  ) {
    throw new MigrationManifestError(`${path} is missing required fields`)
  }
  for (const [phase, state] of Object.entries(parsed.phases)) {
    if (
      !(PHASES as readonly string[]).includes(phase) ||
      !isRecord(state) ||
      !Array.isArray(state.items)
    ) {
      throw new MigrationManifestError(
        `${path} has an invalid phase "${phase}"`
      )
    }
  }
  const manifest = parsed as unknown as MigrationManifest
  return {
    ...manifest,
    files: isRecord(parsed.files) ? manifest.files : {},
    options: {
      keyPrefix:
        typeof parsed.options.keyPrefix === 'string'
          ? parsed.options.keyPrefix
          : '',
      domain:
        typeof parsed.options.domain === 'string'
          ? parsed.options.domain
          : null,
    },
  }
}

/**
 * Binds the manifest to the Resend key it reads with. Contacts and
 * suppressions keep one cursor and one done flag for the whole account, so
 * under another key (another account, or the same account's new key) both
 * passes run again, which their upserts and imports make safe to repeat.
 * Items keyed by Resend ids (templates, segments, topics) need nothing.
 */
export function bindSourceKey(
  manifest: MigrationManifest,
  apiKey: string
): void {
  const hash = createHash('sha256')
    .update(`${manifest.migrationId}\n${apiKey}`)
    .digest('hex')
    .slice(0, 16)
  if (manifest.sourceKeyHash !== undefined && manifest.sourceKeyHash !== hash) {
    for (const id of ['contacts', 'suppressions'] as const) {
      const phase = manifest.phases[id]
      if (phase !== undefined) {
        phase.status = 'planned'
        phase.cursor = null
      }
    }
  }
  manifest.sourceKeyHash = hash
}

export function serializeManifest(manifest: MigrationManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

export function writeManifest(path: string, manifest: MigrationManifest): void {
  writeFileAtomic(path, serializeManifest(manifest), { within: dirname(path) })
}
