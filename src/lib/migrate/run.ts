import { createHash } from 'node:crypto'
import { BrewApiError } from '@brew.new/sdk'
import type { BrewClient } from '../client'
import { CliApiError, CliVendorError } from '../errors'
import type { NextStep } from '../init/report'
import { progress } from '../output'
import { redact } from '../project/vendor-http'
import type { CliContext } from '../types'
import type {
  ItemStatus,
  MigrationItem,
  MigrationManifest,
  MigrationWarning,
  PhaseId,
  PhaseState,
  PhaseStatus,
} from './manifest'
import type { Finding, MigrationMode } from './report'
import type { MigrationSource, SourceInventory, SourceTemplate } from './source'

/** State shared by the phases of one `migrate` run. */

export type BrewDomainRow = {
  readonly domainId: string
  readonly name: string
  readonly status: string
  readonly sendingPurpose: string | null
}

export type ProjectInfo = {
  readonly root: string
  readonly framework: string | null
  readonly typescript: boolean
  readonly libDir: string | null
  readonly packageManager: string | null
  readonly addSdkCommand: string | null
  readonly hasSdk: boolean
}

export type MigrateOptions = {
  readonly mode: MigrationMode
  readonly phases: readonly PhaseId[]
  readonly domain: string | undefined
  readonly manifestPath: string
  readonly keyPrefix: string
  readonly rewriteImports: boolean
}

export type RunContext = {
  readonly ctx: CliContext
  readonly source: MigrationSource
  readonly options: MigrateOptions
  readonly apply: boolean
  readonly manifest: MigrationManifest
  readonly brew: BrewClient | undefined
  readonly inventory: SourceInventory | undefined
  readonly project: ProjectInfo
  readonly prefix: string
  readonly secrets: readonly string[]
  brewDomains: readonly BrewDomainRow[] | null
  targetDomain: BrewDomainRow | null
  /** App-email keys already in Brew; null when Brew was not read. */
  existingKeys: ReadonlySet<string> | null
  readonly templates: Map<string, SourceTemplate | null>
  readonly findings: Finding[]
  readonly nextSteps: NextStep[]
  /** Writes the manifest (no-op on a dry run). */
  readonly persist: () => void
}

export function say(run: RunContext, message: string): void {
  progress(run.ctx, message)
}

/** `mig-<run>-<scope>-<body hash>`: a re-run replays, a changed body is new. */
export function idempotencyKey(
  run: RunContext,
  scope: string,
  body: unknown
): string {
  const hash = createHash('sha256')
    .update(JSON.stringify(body))
    .digest('hex')
    .slice(0, 16)
  return `mig-${run.manifest.migrationId.slice(0, 8)}-${scope.slice(0, 40)}-${hash}`
}

/** Text that came from the user's code or a vendor, safe to print and store. */
export function clean(run: RunContext, text: string): string {
  return redact(text, run.secrets)
}

export function phaseState(run: RunContext, id: PhaseId): PhaseState {
  const existing = run.manifest.phases[id]
  if (existing !== undefined) {
    return existing
  }
  const created: PhaseState = { status: 'planned', items: [] }
  run.manifest.phases[id] = created
  return created
}

/**
 * The item with `item.id`, merged over what an earlier run recorded: a
 * `done` item keeps its status, ids and key; anything else is re-planned
 * (keeping its key, so keys stay stable across runs).
 */
export function reconcileItem(
  phase: PhaseState,
  item: MigrationItem
): MigrationItem {
  const index = phase.items.findIndex((entry) => entry.id === item.id)
  const previous = index === -1 ? undefined : phase.items[index]
  let merged: MigrationItem
  if (previous?.status === 'done') {
    merged = { ...item, ...previous, status: 'done' }
  } else {
    merged = {
      ...item,
      ...(previous?.key === undefined || item.key === undefined
        ? {}
        : { key: previous.key }),
      ...(previous?.cursor === undefined ? {} : { cursor: previous.cursor }),
      ...(previous?.counts === undefined ? {} : { counts: previous.counts }),
      ...(previous?.brew === undefined
        ? {}
        : { brew: { ...previous.brew, ...item.brew } }),
    }
  }
  if (index === -1) {
    phase.items.push(merged)
  } else {
    phase.items[index] = merged
  }
  return merged
}

/** Drops items an earlier run planned that no longer exist (done ones stay). */
export function pruneItems(phase: PhaseState, keep: ReadonlySet<string>): void {
  phase.items = phase.items.filter(
    (item) => keep.has(item.id) || item.status === 'done'
  )
}

export function addWarning(
  target: { warnings?: MigrationWarning[] },
  warning: MigrationWarning
): void {
  const list = target.warnings ?? []
  if (
    !list.some(
      (entry) =>
        entry.code === warning.code && entry.message === warning.message
    )
  ) {
    list.push(warning)
  }
  target.warnings = list
}

/** A phase's status from its items (and its own read/apply outcome). */
export function settlePhase(
  phase: PhaseState,
  input: { readonly apply: boolean; readonly failed?: boolean }
): void {
  if (input.failed === true || phase.error !== undefined) {
    phase.status = 'failed'
    return
  }
  const statuses = new Set<ItemStatus>(phase.items.map((item) => item.status))
  let status: PhaseStatus
  if (statuses.has('failed')) {
    status = statuses.has('done') ? 'partial' : 'failed'
  } else if (statuses.has('planned')) {
    status = input.apply ? 'partial' : 'planned'
  } else if (statuses.has('done')) {
    status = 'done'
  } else if (statuses.has('manual')) {
    status = 'manual'
  } else {
    status =
      phase.counts === undefined ? 'skipped' : input.apply ? 'done' : 'planned'
  }
  phase.status = status
}

/** Never swallow a stop, or a Brew credential problem. */
export function rethrowIfFatal(ctx: CliContext, error: unknown): void {
  ctx.signal.throwIfAborted()
  if (
    (error instanceof BrewApiError || error instanceof CliApiError) &&
    (error.status === 401 || error.status === 403)
  ) {
    throw error
  }
}

export function errorOf(
  run: RunContext,
  error: unknown
): { code: string; message: string } {
  if (error instanceof BrewApiError || error instanceof CliApiError) {
    return { code: error.code, message: clean(run, error.message) }
  }
  if (error instanceof CliVendorError) {
    return {
      code: `${error.vendor.toUpperCase()}_ERROR`,
      message: clean(run, error.message),
    }
  }
  return {
    code: 'ERROR',
    message: clean(run, error instanceof Error ? error.message : String(error)),
  }
}

export function addNextStep(run: RunContext, step: NextStep): void {
  if (!run.nextSteps.some((existing) => existing.id === step.id)) {
    run.nextSteps.push(step)
  }
}
