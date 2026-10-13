import type { McpInstallResult } from '../../commands/mcp/install'
import { EXIT_AUTH, EXIT_OK, EXIT_RUNTIME, EXIT_USAGE } from '../errors'
import type { ChangeAction } from '../project/fs-writer'
import type { AuthId, ExistingEmail, FrameworkId, Runtime } from './detect'
import type { InitPatch } from './patches'

/**
 * `init`'s result: one JSON document (schema `schemas/init-report.json`,
 * `schemaVersion: 1`) that an agent can act on without reading prose.
 * Secrets never appear in it: keys are masked, `.env.local` carries no
 * diff, and every command it suggests resolves credentials itself.
 */

export const INIT_REPORT_SCHEMA_VERSION = 1

export type InitStatus =
  /** A dry run: the plan, nothing changed. */
  | 'planned'
  /** Everything is set up; any next steps are optional. */
  | 'complete'
  /** Set up, but a blocking next step remains (a patch, a deploy). */
  | 'action_required'
  /** A sign-in must be approved first (exit 3). */
  | 'auth_required'
  /** The cwd is a monorepo root with several apps (exit 2). */
  | 'ambiguous_project'
  /** A step failed (exit 1); the rest of the report says what happened. */
  | 'failed'

export type StepStatus = 'done' | 'skipped' | 'planned' | 'pending' | 'failed'

export type InitStepId =
  | 'detect'
  | 'sign-in'
  | 'env'
  | 'brand'
  | 'domain'
  | 'kit'
  | 'install'
  | 'files'
  | 'patches'
  | 'mcp'
  | 'agent-files'
  | 'state'
  | 'test-email'

export type InitStep = {
  readonly id: InitStepId
  readonly status: StepStatus
  readonly detail?: string
}

export type NextStepKind =
  | 'run-command'
  | 'open-url'
  | 'apply-patch'
  | 'edit-file'
  | 'set-secret'
  | 'add-dns-records'
  | 'review'

export type NextStep = {
  readonly id: string
  readonly actor: 'agent' | 'human'
  readonly kind: NextStepKind
  readonly title: string
  /** True when the app does not send its emails until this is done. */
  readonly blocking: boolean
  readonly command?: string
  readonly url?: string
  readonly path?: string
  readonly patchId?: string
}

export type InitEmail = {
  readonly key: string
  readonly ok: boolean
  readonly triggerEventId?: string
  readonly automationId?: string
  readonly published?: boolean
  readonly sender?: 'domain' | 'sandbox'
  readonly created?: boolean
  readonly error?: { readonly code: string; readonly message: string }
}

export type InitFile = {
  readonly path: string
  readonly action: ChangeAction | 'planned'
  readonly role: string
  readonly note?: string
}

export type DnsRecord = {
  readonly type: string
  readonly name: string
  readonly value: string
  readonly priority?: number
}

export type InitReport = {
  readonly schemaVersion: 1
  readonly status: InitStatus
  readonly dryRun: boolean
  readonly project: {
    readonly root: string
    readonly name: string
    readonly projectId: string | null
    readonly packageManager: string | null
    readonly monorepo: {
      readonly tool: string
      readonly root: string
      readonly workspace: string | null
    } | null
    readonly candidates?: ReadonlyArray<{
      readonly name: string
      readonly dir: string
      readonly framework: string
    }>
    readonly framework: FrameworkId | null
    readonly runtime: Runtime | null
    readonly auth: AuthId | null
    readonly authVersion: 'v4' | 'v5' | null
    readonly authDetected: readonly AuthId[]
    readonly billing: readonly string[]
    readonly existingEmail: readonly ExistingEmail[]
    readonly builder: string | null
    readonly typescript: boolean
    readonly editors: readonly string[]
    readonly remote: string | null
  }
  readonly brand: {
    readonly brandId: string
    readonly name: string | null
  } | null
  readonly credential: {
    /** Where this run's API key came from. */
    readonly source: 'flag' | 'env' | 'config' | 'env-file' | 'browser' | 'none'
    /** Masked: `brew_abc…xyz`. */
    readonly apiKey: string | null
    readonly appKey: {
      readonly variable: string
      readonly file: string
      readonly status: 'existing' | 'written' | 'planned' | 'missing'
      readonly masked: string | null
    }
  }
  readonly domain: {
    readonly mode: 'domain' | 'sandbox' | 'unknown'
    readonly domainId: string | null
    readonly name: string | null
    readonly status: string | null
    readonly added: boolean
    readonly records: readonly DnsRecord[]
    readonly settingsUrl: string
    readonly sandbox: { readonly note: string } | null
  }
  readonly stack: {
    readonly provider: string
    readonly authDelivery: string | null
    readonly note: string | null
  } | null
  readonly emails: readonly InitEmail[]
  readonly files: readonly InitFile[]
  readonly patches: readonly InitPatch[]
  readonly mcp: readonly McpInstallResult[]
  readonly testEmail: {
    readonly status: 'sent' | 'replayed' | 'skipped' | 'planned' | 'failed'
    readonly key: string | null
    readonly to: string | null
    readonly triggerInstanceId?: string
    readonly reason?: string
  }
  readonly steps: readonly InitStep[]
  readonly nextSteps: readonly NextStep[]
  readonly agentInstructions: string
}

/** The exit code that goes with a report's status. */
export function exitCodeFor(status: InitStatus): number {
  switch (status) {
    case 'failed':
      return EXIT_RUNTIME
    case 'ambiguous_project':
      return EXIT_USAGE
    case 'auth_required':
      return EXIT_AUTH
    default:
      return EXIT_OK
  }
}

/** The overall status, from the steps and what is left to do. */
export function overallStatus(input: {
  readonly dryRun: boolean
  readonly steps: readonly InitStep[]
  readonly nextSteps: readonly NextStep[]
}): InitStatus {
  if (input.steps.some((step) => step.status === 'pending')) {
    return 'auth_required'
  }
  if (input.steps.some((step) => step.status === 'failed')) {
    return 'failed'
  }
  if (input.dryRun) {
    return 'planned'
  }
  return input.nextSteps.some((step) => step.blocking)
    ? 'action_required'
    : 'complete'
}

const STEP_LABELS: Readonly<Record<InitStepId, string>> = {
  detect: 'Detect project',
  'sign-in': 'Sign in',
  env: 'App key in .env.local',
  brand: 'Brand',
  domain: 'Sending domain',
  kit: 'Starter kit',
  install: 'Install @brew.new/sdk',
  files: 'Write files',
  patches: 'Auth config patches',
  mcp: 'MCP clients',
  'agent-files': 'AGENTS.md and skills',
  state: 'brew.json',
  'test-email': 'Test email',
}

const STATUS_MARKS: Readonly<Record<StepStatus, string>> = {
  done: 'done',
  skipped: 'skipped',
  planned: 'planned',
  pending: 'waiting',
  failed: 'FAILED',
}

const HEADLINES: Readonly<Record<InitStatus, string>> = {
  planned: 'Plan (dry run, nothing changed):',
  complete: 'Brew is set up.',
  action_required: 'Brew is set up. Finish the steps marked "needed".',
  auth_required: 'Sign in to finish setting up Brew.',
  ambiguous_project: 'This is a monorepo with several apps: pick one.',
  failed: 'Setup did not finish.',
}

/** The human rendering (TTY): steps, files, patches, next steps. */
export function renderReport(report: InitReport): string {
  const lines: string[] = [HEADLINES[report.status], '']
  const { project } = report
  if (project.framework !== null) {
    lines.push(
      `Project: ${project.name} (${project.framework}${project.auth === null || project.auth === 'none' ? '' : `, ${project.auth}${project.authVersion === null ? '' : ` ${project.authVersion}`}`}${project.packageManager === null ? '' : `, ${project.packageManager}`})`
    )
  }
  if (report.brand !== null) {
    lines.push(`Brand: ${report.brand.name ?? report.brand.brandId}`)
  }
  if (project.candidates !== undefined) {
    for (const candidate of project.candidates) {
      lines.push(`  ${candidate.dir}  (${candidate.framework})`)
    }
  }
  if (report.steps.length > 0) {
    lines.push('')
    for (const step of report.steps) {
      lines.push(
        `  ${STATUS_MARKS[step.status].padEnd(8)} ${STEP_LABELS[step.id]}${step.detail === undefined ? '' : `: ${step.detail}`}`
      )
    }
  }
  const changed = report.files.filter((file) => file.action !== 'unchanged')
  if (changed.length > 0) {
    lines.push('', 'Files:')
    for (const file of changed) {
      lines.push(
        `  ${file.action.padEnd(17)} ${file.path}${file.note === undefined ? '' : ` (${file.note})`}`
      )
    }
  }
  for (const patch of report.patches) {
    if (patch.status === 'pending' && patch.diff !== undefined) {
      lines.push(
        '',
        `Patch ${patch.id} (${patch.path}): ${patch.title}`,
        patch.diff.trimEnd()
      )
    } else if (patch.status === 'manual' && patch.snippet !== undefined) {
      lines.push(
        '',
        `Add by hand to ${patch.path}: ${patch.title}`,
        patch.description,
        patch.snippet
      )
    }
  }
  if (report.domain.records.length > 0) {
    lines.push('', `DNS records for ${report.domain.name ?? 'your domain'}:`)
    for (const record of report.domain.records) {
      lines.push(`  ${record.type.padEnd(6)} ${record.name}  ${record.value}`)
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
  return lines.join('\n')
}
