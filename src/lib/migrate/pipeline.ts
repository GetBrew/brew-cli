import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { BrewClient } from '../client'
import { type Clock, systemClock } from '../clock'
import { buildConfirmCommand } from '../confirm'
import type { CommandOutcome, CommandSpec } from '../define-command'
import { CliAuthError, CliUsageError } from '../errors'
import { detectProject } from '../init/detect'
import type { NextStep } from '../init/report'
import { reachesSdkRange, SDK_PACKAGE, SDK_RANGE } from '../init/templates'
import { getInvocationPrefix } from '../invocation'
import { addCommand, formatCommandLine } from '../project/package-manager'
import type { RerunInvocation } from '../rerun'
import type { CliContext } from '../types'
import {
  bindSourceKey,
  createManifest,
  type MigrationManifest,
  MigrationManifestError,
  PHASES,
  type PhaseId,
  readManifest,
  writeManifest,
} from './manifest'
import { codePhase } from './phase-code'
import {
  automationsPhase,
  broadcastsPhase,
  domainsPhase,
  templatesPhase,
  webhooksPhase,
} from './phases'
import {
  contactsPhase,
  segmentsPhase,
  suppressionsPhase,
  topicsPhase,
} from './phases-contacts'
import {
  exitCodeForMigration,
  type Finding,
  MIGRATION_REPORT_SCHEMA_VERSION,
  type MigrationReport,
  type MigrationStatus,
  renderMigrationReport,
} from './report'
import { ResendAccessError } from './resend/client'
import {
  type BrewDomainRow,
  errorOf,
  type MigrateOptions,
  type ProjectInfo,
  type RunContext,
  rethrowIfFatal,
  say,
} from './run'
import type { MigrationSource } from './source'

/**
 * `migrate <source>`: plan (default) → review `brew.migration.json` →
 * `--apply`. Reads the source account with a key that never leaves this
 * machine for Brew, reads Brew to plan keys and domains, and only writes to
 * Brew (and the project's files) on `--apply`.
 */

export type MigrateInput = MigrateOptions & {
  readonly cwd: string
  readonly sourceKey: {
    readonly value: string
    readonly from: 'stdin' | 'env'
  } | null
  readonly clock?: Clock
  /** The parsed invocation, re-serialized into the apply command it prints. */
  readonly rerun: {
    readonly command: Pick<CommandSpec, 'path' | 'flags' | 'args'>
    readonly invocation: RerunInvocation
  }
}

const PHASE_RUNNERS: Readonly<
  Record<Exclude<PhaseId, 'code'>, (run: RunContext) => Promise<void>>
> = {
  domains: domainsPhase,
  templates: templatesPhase,
  contacts: contactsPhase,
  segments: segmentsPhase,
  suppressions: suppressionsPhase,
  topics: topicsPhase,
  broadcasts: broadcastsPhase,
  webhooks: webhooksPhase,
  automations: automationsPhase,
}

function projectInfo(cwd: string, env: CliContext['io']['env']): ProjectInfo {
  const detected = detectProject(cwd, { env })
  if (detected.kind !== 'project') {
    return {
      root: detected.kind === 'ambiguous' ? detected.root : cwd,
      framework: null,
      typescript: false,
      libDir: null,
      packageManager: null,
      addSdkCommand: null,
      hasSdk: false,
    }
  }
  const { project } = detected
  // An SDK older than SDK_RANGE cannot load `@brew.new/sdk/resend`, so it
  // counts as missing: the install step asks for SDK_RANGE over it.
  let hasSdk = reachesSdkRange(project.sdkRange)
  try {
    const pkg = JSON.parse(
      readFileSync(join(project.root, 'package.json'), 'utf8')
    ) as {
      dependencies?: Record<string, string>
    }
    hasSdk = reachesSdkRange(pkg.dependencies?.['@brew.new/sdk'])
  } catch {}
  return {
    root: project.root,
    framework: project.framework,
    typescript: project.typescript,
    libDir: project.libDir,
    packageManager: project.packageManager.name,
    addSdkCommand: formatCommandLine(
      addCommand(project.packageManager, [`${SDK_PACKAGE}@${SDK_RANGE}`])
    ),
    hasSdk,
  }
}

async function readBrew(run: RunContext): Promise<{
  brand: MigrationReport['brand']
}> {
  const brew = run.brew
  if (brew === undefined) {
    return { brand: null }
  }
  let brand: MigrationReport['brand'] = null
  try {
    const row = await brew.brand.get()
    brand = {
      brandId: row.brandId,
      name: row.identity?.brandName ?? row.domain ?? null,
    }
  } catch (error) {
    rethrowIfFatal(run.ctx, error)
    run.findings.push({
      code: 'BREW_BRAND_UNREADABLE',
      severity: 'warning',
      message: `Could not read the Brew brand: ${errorOf(run, error).message}`,
    })
  }
  if (brand !== null) {
    // Done items and cursors belong to the brand the manifest records.
    const recorded = run.manifest.brandId
    if (recorded !== null && recorded !== brand.brandId) {
      throw new CliUsageError(
        `${run.options.manifestPath} records a migration into Brew brand ${recorded}, not ${brand.brandId}. Use that brand's API key, or start a separate migration with --manifest <path>.`
      )
    }
    run.manifest.brandId = brand.brandId
  }
  try {
    const list = await brew.domains.list({ limit: 100 })
    run.brewDomains = list.data.map((row) => ({
      domainId: row.domainId,
      name: row.name,
      status: row.status,
      sendingPurpose: row.sendingPurpose ?? null,
    }))
  } catch (error) {
    rethrowIfFatal(run.ctx, error)
    run.findings.push({
      code: 'BREW_DOMAINS_UNREADABLE',
      severity: 'warning',
      message: `Could not list Brew domains: ${errorOf(run, error).message}`,
    })
  }
  try {
    const keys = new Set<string>()
    let cursor: string | undefined
    for (let page = 0; page < 20; page += 1) {
      const list = await brew.appEmails.list({
        limit: 100,
        ...(cursor === undefined ? {} : { cursor }),
      })
      for (const row of list.data) {
        keys.add(row.triggerKey)
      }
      if (!list.pagination.hasMore || list.pagination.cursor === null) {
        break
      }
      cursor = list.pagination.cursor
    }
    run.existingKeys = keys
  } catch (error) {
    rethrowIfFatal(run.ctx, error)
    run.findings.push({
      code: 'BREW_APP_EMAILS_UNREADABLE',
      severity: 'warning',
      message: `Could not list Brew app emails (keys are planned without checking them): ${errorOf(run, error).message}`,
    })
  }
  return { brand }
}

function resolveTargetDomain(run: RunContext, flag: string | undefined): void {
  // A run without --domain resumes on the domain the manifest records.
  const domain = flag ?? run.manifest.options.domain ?? undefined
  if (domain === undefined) {
    return
  }
  const names = (row: BrewDomainRow, text: string) =>
    row.domainId === text || row.name.toLowerCase() === text.toLowerCase()
  const match = run.brewDomains?.find((row) => names(row, domain))
  // Unsubscribe imports resume from cursors read for the recorded domain,
  // which --domain may name by its id or its name.
  const recorded = run.manifest.options.domain
  if (
    recorded !== null &&
    recorded.toLowerCase() !== domain.toLowerCase() &&
    (match === undefined || !names(match, recorded))
  ) {
    throw new CliUsageError(
      `${run.options.manifestPath} records --domain ${recorded}. Pass --domain ${recorded}, or start a separate migration with --manifest <path>.`
    )
  }
  if (run.brewDomains === null) {
    return
  }
  if (match === undefined) {
    throw new CliUsageError(
      `--domain ${domain} is not a domain of this Brew brand. List them with \`${run.prefix} domains list\`.`
    )
  }
  // Contacts moved before any domain was named never reached its
  // unsubscribe list: their pass runs again (an upsert's consent never
  // re-subscribes an opt-out).
  const contacts = run.manifest.phases.contacts
  if (recorded === null && contacts?.status === 'done') {
    contacts.status = 'planned'
  }
  run.manifest.options.domain = domain
  run.targetDomain = match
}

function overallStatus(input: {
  readonly mode: MigrateOptions['mode']
  readonly manifest: MigrationManifest
  readonly phases: readonly PhaseId[]
  readonly findings: readonly Finding[]
  readonly nextSteps: readonly NextStep[]
}): MigrationStatus {
  if (
    input.findings.some(
      (finding) =>
        finding.code === 'RESEND_KEY_SENDING_ONLY' ||
        finding.code === 'RESEND_KEY_REJECTED'
    )
  ) {
    return 'auth_required'
  }
  const failed = input.phases.some((id) => {
    const phase = input.manifest.phases[id]
    return (
      phase !== undefined &&
      (phase.status === 'failed' ||
        phase.status === 'partial' ||
        phase.items.some((item) => item.status === 'failed'))
    )
  })
  if (
    failed ||
    input.findings.some((finding) => finding.severity === 'error')
  ) {
    return 'failed'
  }
  if (input.mode !== 'apply') {
    return 'planned'
  }
  return input.nextSteps.some((step) => step.blocking)
    ? 'action_required'
    : 'complete'
}

function agentInstructions(
  report: Omit<MigrationReport, 'agentInstructions'>
): string {
  const parts: string[] = []
  switch (report.status) {
    case 'planned':
      parts.push(
        `Review ${report.manifest.path} (or this report) with the person, then apply it with the apply nextStep; nothing changed yet.`
      )
      break
    case 'auth_required':
      parts.push(
        'The Resend key cannot read the account. Ask the person for a full-access Resend API key and pass it on stdin with --resend-key-stdin; never print or store it.'
      )
      break
    case 'failed':
      parts.push(
        'Something failed (see phases[].error and items[].error). Fix the cause and run the same command again: done items are skipped and paged phases resume from their cursor.'
      )
      break
    default:
      parts.push('The Resend account is copied into Brew.')
  }
  const blocking = report.nextSteps.filter((step) => step.blocking)
  if (blocking.length > 0) {
    parts.push(
      `Do the blocking nextSteps (${blocking.length}); edit-file steps carry a suggested brew.send replacement. Hand human steps to the person.`
    )
  }
  parts.push(
    'Keep Resend configured (domain, key, webhooks) until a Brew send is verified; never delete Resend data from this flow.'
  )
  return parts.join(' ')
}

export async function runMigration(
  ctx: CliContext,
  source: MigrationSource,
  input: MigrateInput
): Promise<CommandOutcome> {
  const prefix = getInvocationPrefix(ctx.io.env)
  const clock = input.clock ?? ctx.io.clock ?? systemClock
  const apply = input.mode === 'apply'
  const manifestPath = resolve(input.cwd, input.manifestPath)
  let previous: MigrationManifest | null
  try {
    previous = readManifest(manifestPath)
  } catch (error) {
    if (error instanceof MigrationManifestError) {
      throw new CliUsageError(
        `${error.message}. Fix or remove it, then run the migration again.`
      )
    }
    throw error
  }
  const now = new Date(clock.now()).toISOString()
  const manifest =
    previous ?? createManifest({ now, keyPrefix: input.keyPrefix })

  const accountPhases = input.phases.filter((phase) => phase !== 'code')
  if (accountPhases.length > 0 && input.sourceKey === null) {
    throw new CliUsageError(
      `Reading the ${source.displayName} account needs its API key: set ${source.envKey}, or pipe it with --resend-key-stdin. (--only code scans the project without one.)`
    )
  }
  if (input.sourceKey !== null) {
    bindSourceKey(manifest, input.sourceKey.value)
  }

  let brew: BrewClient | undefined
  try {
    brew = ctx.client()
  } catch (error) {
    if (!(error instanceof CliAuthError) || apply) {
      throw error
    }
  }

  const project = projectInfo(input.cwd, ctx.io.env)
  const secrets = [
    ...(input.sourceKey === null ? [] : [input.sourceKey.value]),
    ...(ctx.globals.apiKey === undefined ? [] : [ctx.globals.apiKey]),
    ...(ctx.io.env.BREW_API_KEY === undefined ? [] : [ctx.io.env.BREW_API_KEY]),
  ].filter((secret) => secret.length >= 4)
  const run: RunContext = {
    ctx,
    source,
    options: input,
    apply,
    manifest,
    brew,
    inventory:
      input.sourceKey === null
        ? undefined
        : source.inventory(ctx, { apiKey: input.sourceKey.value, clock }),
    project,
    prefix,
    secrets,
    brewDomains: null,
    targetDomain: null,
    existingKeys: null,
    templates: new Map(),
    findings: [],
    nextSteps: [],
    persist: () => {
      if (input.mode === 'dry-run') {
        return
      }
      manifest.updatedAt = new Date(clock.now()).toISOString()
      writeManifest(manifestPath, manifest)
    },
  }

  say(
    run,
    `${apply ? 'Migrating' : 'Planning a migration'} from ${source.displayName} (${input.phases.join(', ')})…`
  )
  const { brand } = await readBrew(run)
  if (brew === undefined) {
    run.findings.push({
      code: 'BREW_SIGN_IN_NEEDED',
      severity: 'info',
      message:
        'No Brew API key: the plan checks nothing in Brew (keys, domains). Applying needs one.',
    })
    run.nextSteps.push({
      id: 'brew-login',
      actor: 'human',
      kind: 'run-command',
      command: `${prefix} login`,
      title: 'Sign in to Brew (applying writes to your brand)',
      blocking: true,
    })
  }
  resolveTargetDomain(run, input.domain)

  let engine: MigrationReport['project']['scanEngine'] = null
  let filesScanned = 0
  let stopAccount = false
  try {
    for (const id of PHASES) {
      if (!input.phases.includes(id)) {
        continue
      }
      ctx.signal.throwIfAborted()
      if (id === 'code') {
        const result = await codePhase(run)
        engine = result.engine
        filesScanned = result.filesScanned
        continue
      }
      if (stopAccount) {
        continue
      }
      try {
        await PHASE_RUNNERS[id](run)
      } catch (error) {
        if (error instanceof ResendAccessError) {
          stopAccount = true
          run.findings.push({
            code:
              error.reason === 'sending_only'
                ? 'RESEND_KEY_SENDING_ONLY'
                : 'RESEND_KEY_REJECTED',
            severity: 'error',
            message: error.message,
          })
          run.nextSteps.push({
            id: 'resend-full-access-key',
            actor: 'human',
            kind: 'open-url',
            url: 'https://resend.com/api-keys',
            title:
              'Create a Resend API key with Full access (a sending-only key cannot read templates, contacts or domains), then pass it with --resend-key-stdin',
            blocking: true,
          })
          continue
        }
        rethrowIfFatal(ctx, error)
        const phase = manifest.phases[id] ?? {
          status: 'failed' as const,
          items: [],
        }
        phase.status = 'failed'
        phase.error = errorOf(run, error)
        manifest.phases[id] = phase
      }
      run.persist()
    }
  } finally {
    run.persist()
  }

  if (apply) {
    // An email left to a person is not migrated until they finish it.
    const unfinished = (['templates', 'code'] as const)
      .filter((id) => input.phases.includes(id))
      .flatMap((id) => manifest.phases[id]?.items ?? [])
      .filter((item) => item.status === 'manual' && item.kind !== 'rewrite')
    for (const item of unfinished) {
      run.nextSteps.push({
        id: `finish-${item.id}`,
        actor: item.kind === 'react-email' ? 'agent' : 'human',
        kind: 'review',
        title: `${item.name} (${item.key}) is not migrated: ${item.detail ?? 'see the manifest'}`,
        blocking: true,
      })
    }
    const keys = (manifest.phases.templates?.items ?? [])
      .concat(manifest.phases.code?.items ?? [])
      .filter((item) => item.status === 'done' && item.key !== undefined)
    const first = keys[0]
    if (first?.key !== undefined) {
      run.nextSteps.push({
        id: 'verify-send',
        actor: 'agent',
        kind: 'run-command',
        command: `${prefix} send ${first.key} --to <your-email> --yes`,
        title: `Send one migrated email to yourself (until a domain verifies, Brew delivers to your team only), and check app-emails list shows every key ready`,
        blocking: false,
      })
    }
    run.nextSteps.push({
      id: 'cut-over',
      actor: 'human',
      kind: 'review',
      title:
        'Cut over once Brew sends are verified: switch production to BREW_API_KEY, then retire RESEND_API_KEY and the resend package. Keep the Resend domain and webhooks until then',
      blocking: false,
    })
  } else if (input.mode === 'plan') {
    run.nextSteps.unshift({
      id: 'apply',
      actor: 'agent',
      kind: 'run-command',
      command: buildConfirmCommand(
        {
          args: input.rerun.invocation.args,
          flags: {
            ...input.rerun.invocation.flags,
            dryRun: undefined,
            apply: true,
          },
        },
        input.rerun.command,
        undefined,
        prefix
      ),
      title: `After the person reviews ${input.manifestPath}, apply the plan (nothing in ${source.displayName} is changed or deleted)${input.sourceKey?.from === 'stdin' ? '; pipe the Resend key in again' : ''}`,
      blocking: true,
    })
  }

  const phases = PHASES.filter((id) => input.phases.includes(id)).flatMap(
    (id) => {
      const phase = manifest.phases[id]
      return phase === undefined ? [] : [{ id, ...phase }]
    }
  )
  const status = overallStatus({
    mode: input.mode,
    manifest,
    phases: input.phases,
    findings: run.findings,
    nextSteps: run.nextSteps,
  })
  const base: Omit<MigrationReport, 'agentInstructions'> = {
    schemaVersion: MIGRATION_REPORT_SCHEMA_VERSION,
    status,
    mode: input.mode,
    source: source.id,
    manifest: { path: input.manifestPath, written: input.mode !== 'dry-run' },
    brand,
    resend: {
      keySource: input.sourceKey?.from ?? 'none',
      requests: run.inventory?.requestCount() ?? 0,
    },
    project: {
      root: project.root,
      framework: project.framework,
      typescript: project.typescript,
      scanEngine: engine,
      filesScanned,
    },
    phases,
    callSites: manifest.callSites,
    findings: run.findings,
    nextSteps: run.nextSteps,
  }
  const report: MigrationReport = {
    ...base,
    agentInstructions: agentInstructions(base),
  }
  const exitCode = exitCodeForMigration(status)
  return {
    data: report,
    human: renderMigrationReport(report),
    ...(exitCode === 0 ? {} : { exitCode }),
  }
}
