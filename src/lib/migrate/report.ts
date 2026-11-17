import { EXIT_AUTH, EXIT_OK, EXIT_RUNTIME } from '../errors'
import type { NextStep } from '../init/report'
import type {
  CallSiteRecord,
  MigrationItem,
  MigrationWarning,
  PhaseId,
  PhaseState,
} from './manifest'

/**
 * `migrate resend`'s result: one JSON document an agent can act on. Its
 * `nextSteps` use the same shape as `init`'s report. Like the manifest, it
 * never carries a contact address, a key or a token.
 */

export const MIGRATION_REPORT_SCHEMA_VERSION = 1

export type MigrationMode = 'plan' | 'dry-run' | 'apply'

export type MigrationStatus =
  /** A plan (or dry run): nothing changed in Resend or Brew. */
  | 'planned'
  /** Applied; nothing blocking is left. */
  | 'complete'
  /** Applied; call sites or other blocking steps remain. */
  | 'action_required'
  /** The Resend key cannot read the account (exit 3). */
  | 'auth_required'
  /** A phase or an item failed (exit 1); re-run to resume. */
  | 'failed'

export type Finding = {
  readonly code: string
  readonly severity: 'error' | 'warning' | 'info'
  readonly message: string
}

export type PhaseReport = {
  readonly id: PhaseId
} & PhaseState

export type MigrationReport = {
  readonly schemaVersion: 1
  readonly status: MigrationStatus
  readonly mode: MigrationMode
  readonly source: 'resend'
  readonly manifest: { readonly path: string; readonly written: boolean }
  readonly brand: {
    readonly brandId: string
    readonly name: string | null
  } | null
  readonly resend: {
    readonly keySource: 'stdin' | 'env' | 'none'
    readonly requests: number
  }
  readonly project: {
    readonly root: string
    readonly framework: string | null
    readonly typescript: boolean
    readonly scanEngine: 'typescript' | 'tokenizer' | null
    readonly filesScanned: number
  }
  readonly phases: readonly PhaseReport[]
  readonly callSites: readonly CallSiteRecord[]
  readonly findings: readonly Finding[]
  readonly nextSteps: readonly NextStep[]
  readonly agentInstructions: string
}

export function exitCodeForMigration(status: MigrationStatus): number {
  switch (status) {
    case 'failed':
      return EXIT_RUNTIME
    case 'auth_required':
      return EXIT_AUTH
    default:
      return EXIT_OK
  }
}

const HEADLINES: Readonly<Record<MigrationStatus, string>> = {
  planned: 'Migration plan from Resend (nothing changed in Resend or Brew):',
  complete: 'Migrated from Resend.',
  action_required:
    'Migrated from Resend. Finish the steps marked "needed" to cut over.',
  auth_required: 'Resend did not let this key read the account.',
  failed: 'The migration did not finish. Run the same command again to resume.',
}

const PHASE_LABELS: Readonly<Record<PhaseId, string>> = {
  domains: 'Domains',
  templates: 'Templates',
  code: 'Code',
  contacts: 'Contacts',
  segments: 'Segments',
  suppressions: 'Suppressions',
  topics: 'Topics',
  broadcasts: 'Broadcasts',
  webhooks: 'Webhooks',
  automations: 'Automations',
}

function countsLine(
  counts: Readonly<Record<string, number>> | undefined
): string {
  if (counts === undefined) {
    return ''
  }
  const parts = Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => `${value} ${name}`)
  return parts.length === 0 ? '' : ` (${parts.join(', ')})`
}

function itemLine(item: MigrationItem): string {
  const target = item.key === undefined ? '' : ` → ${item.key}`
  const detail = item.error?.message ?? item.detail
  return `    ${item.status.padEnd(8)} ${item.name}${target}${detail === undefined ? '' : `: ${detail}`}`
}

function warningLines(
  warnings: readonly MigrationWarning[] | undefined
): string[] {
  return (warnings ?? []).map((warning) => `             ! ${warning.message}`)
}

/** The human rendering (TTY). */
export function renderMigrationReport(report: MigrationReport): string {
  const lines: string[] = [HEADLINES[report.status], '']
  if (report.brand !== null) {
    lines.push(`Brew brand: ${report.brand.name ?? report.brand.brandId}`)
  }
  for (const phase of report.phases) {
    lines.push(
      `  ${phase.status.padEnd(8)} ${PHASE_LABELS[phase.id]}${countsLine(phase.counts)}${phase.detail === undefined ? '' : `: ${phase.detail}`}`
    )
    lines.push(...warningLines(phase.warnings))
    for (const item of phase.items) {
      lines.push(itemLine(item))
      lines.push(...warningLines(item.warnings))
    }
  }
  if (report.callSites.length > 0) {
    lines.push('', 'Resend call sites:')
    for (const site of report.callSites) {
      lines.push(
        `  ${site.status.padEnd(8)} ${site.file}:${site.line} ${site.method} (${site.kind})${site.unsupported.length === 0 ? '' : `; doesn't carry over: ${site.unsupported.join(', ')}`}`
      )
      lines.push(`           ${site.replacement}`)
    }
  }
  const notable = report.findings.filter(
    (finding) => finding.severity !== 'info'
  )
  if (notable.length > 0) {
    lines.push('', 'Findings:')
    for (const finding of notable) {
      lines.push(`  ${finding.severity.padEnd(8)} ${finding.message}`)
    }
  }
  if (report.nextSteps.length > 0) {
    lines.push('', 'Next:')
    for (const step of report.nextSteps) {
      const target = step.command ?? step.url ?? step.path
      lines.push(
        `  ${step.blocking ? 'needed  ' : 'optional'} ${step.title}${target === undefined ? '' : `\n           ${target}`}`
      )
    }
  }
  lines.push(
    '',
    report.manifest.written
      ? `Progress is in ${report.manifest.path}.`
      : `Dry run: ${report.manifest.path} was not written.`
  )
  return lines.join('\n')
}
