import type { EmailImportInput } from '@brew.new/sdk'
import { asSdkInput } from '../input'
import {
  type ImportResponse,
  importAndSetUp,
  looksLikeMissingImportModes,
  recordImportWarnings,
} from './import-setup'
import { deriveKey, isCanonicalKitKey } from './keys'
import type { MigrationItem, PhaseState } from './manifest'
import {
  addNextStep,
  addWarning,
  clean,
  errorOf,
  idempotencyKey,
  keepsKey,
  phaseState,
  pruneItems,
  type RunContext,
  reconcileItem,
  rethrowIfFatal,
  say,
  settlePhase,
} from './run'
import type { SourceTemplate } from './source'

/**
 * The account phases: what lives in the Resend account (domains, templates,
 * broadcasts; contacts, segments, suppressions and topics are in
 * `phases-contacts.ts`) and what only gets reported (webhooks,
 * automations). Each reads through the source's inventory, plans items, and
 * on `--apply` executes them, persisting the manifest after every item or
 * page so a re-run resumes.
 */

const CONTACT_FIELDS = new Set(['FIRST_NAME', 'LAST_NAME', 'EMAIL'])
const VARIABLE_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/

export function inventoryOf(run: RunContext) {
  const inventory = run.inventory
  if (inventory === undefined) {
    throw new Error('This phase reads Resend, and no Resend key was given.')
  }
  return inventory
}

export function brewOf(run: RunContext) {
  const brew = run.brew
  if (brew === undefined) {
    throw new Error('Applying needs a Brew API key.')
  }
  return brew
}

/** A subdomain Brew can sign without touching Resend's `resend._domainkey`. */
export function suggestSubdomain(
  name: string,
  taken: ReadonlySet<string>
): string {
  const parts = name.split('.')
  const base = parts.length > 2 ? parts.slice(1).join('.') : name
  for (const label of ['mail', 'send', 'notify', 'brew']) {
    const candidate = `${label}.${base}`
    if (!taken.has(candidate)) {
      return candidate
    }
  }
  return `brew.${name}`
}

// ---- Domains (report only).

export async function domainsPhase(run: RunContext): Promise<void> {
  const phase = phaseState(run, 'domains')
  const domains = await inventoryOf(run).domains()
  say(run, `Resend: ${domains.length} domains`)
  const resendNames = new Set(
    domains.map((domain) => domain.name.toLowerCase())
  )
  const brewNames = new Set(
    (run.brewDomains ?? []).map((domain) => domain.name.toLowerCase())
  )
  const taken = new Set([...resendNames, ...brewNames])
  const keep = new Set<string>()
  const suggestions: string[] = []
  for (const domain of domains) {
    const id = `domain:${domain.id}`
    keep.add(id)
    const suggestion = suggestSubdomain(domain.name.toLowerCase(), taken)
    const inBrew = brewNames.has(domain.name.toLowerCase())
    const item = reconcileItem(phase, {
      id,
      kind: 'domain',
      status: 'manual',
      name: domain.name,
      sourceId: domain.id,
      detail: `${domain.status} in Resend; Brew signs with the same DKIM selector (resend._domainkey), so send from ${suggestion} in Brew and keep ${domain.name} on Resend until cutover`,
    })
    item.warnings = []
    if (inBrew) {
      addWarning(item, {
        code: 'DKIM_SELECTOR_IN_USE',
        message: `${domain.name} is in Brew and in Resend: both need resend._domainkey.${domain.name}, which holds one key. Verify a subdomain in Brew instead, or move ${domain.name} after Resend is retired.`,
      })
    }
    if (!inBrew) {
      suggestions.push(suggestion)
    }
  }
  pruneItems(phase, keep)
  const target = run.targetDomain
  if (target !== null && resendNames.has(target.name.toLowerCase())) {
    run.findings.push({
      code: 'DKIM_SELECTOR_IN_USE',
      severity: 'warning',
      message: `--domain ${target.name} is also a Resend domain; its resend._domainkey record serves one of them only.`,
    })
  }
  const verified = (run.brewDomains ?? []).some(
    (domain) => domain.status === 'verified'
  )
  const first = suggestions[0]
  if (!verified && first !== undefined) {
    addNextStep(run, {
      id: 'add-brew-domain',
      actor: 'human',
      kind: 'add-dns-records',
      title: `Add a sending domain in Brew on a subdomain Resend does not use (${suggestions.join(', ')}), then add its DNS records; until it verifies, app emails reach your Brew team only`,
      command: `${run.prefix} domains add ${first}`,
      blocking: false,
    })
  }
  settlePhase(phase, { apply: run.apply })
  if (domains.length === 0) {
    phase.status = run.apply ? 'done' : 'planned'
    phase.detail = 'no domains in Resend'
  }
}

// ---- Templates.

async function loadTemplate(
  run: RunContext,
  id: string
): Promise<SourceTemplate | null> {
  if (!run.templates.has(id)) {
    run.templates.set(id, await inventoryOf(run).template(id))
  }
  return run.templates.get(id) ?? null
}

function parseFrom(
  from: string | null
): { localPart?: string; name?: string } | undefined {
  if (from === null) {
    return undefined
  }
  const match = /^\s*(?:"?([^"<]*?)"?\s*)?<([^<>@\s]+)@[^<>\s]+>\s*$/.exec(from)
  const bare = /^\s*([^<>@\s]+)@[^<>\s]+\s*$/.exec(from)
  const name = match?.[1]?.trim()
  const localPart = (match?.[2] ?? bare?.[1])?.trim()
  if (localPart === undefined || localPart.length > 64) {
    return undefined
  }
  return {
    localPart,
    ...(name === undefined || name === '' ? {} : { name: name.slice(0, 100) }),
  }
}

function planTemplate(
  run: RunContext,
  item: MigrationItem,
  template: SourceTemplate | null
): void {
  item.warnings = []
  delete item.error
  if (template === null) {
    item.status = 'skipped'
    item.detail = 'no longer in Resend'
    return
  }
  if (template.html === null) {
    item.status = 'manual'
    item.detail = 'has no HTML body in Resend; design it in Brew'
    return
  }
  item.status = 'planned'
  const published = template.status === 'published'
  const existing = run.existingKeys?.has(item.key ?? '') === true
  item.detail = `→ app email ${item.key} (${published ? 'published' : 'not published: a draft in Resend'}), ${template.variables.length} variable${template.variables.length === 1 ? '' : 's'}${existing ? '; updates the app email Brew already has' : ''}`
  for (const variable of template.variables) {
    if (CONTACT_FIELDS.has(variable.key)) {
      addWarning(item, {
        code: 'CONTACT_FIELD_VARIABLE',
        message: `{{{${variable.key}}}} reads the recipient's Brew contact record, not the send payload.`,
      })
    }
  }
}

export async function templatesPhase(run: RunContext): Promise<void> {
  const phase = phaseState(run, 'templates')
  delete phase.error
  const summaries = await inventoryOf(run).templates()
  say(run, `Resend: ${summaries.length} templates`)
  const taken = new Set<string>()
  const ours = new Set<string>()
  for (const item of [
    ...phase.items,
    ...(run.manifest.phases.code?.items ?? []),
  ]) {
    if (keepsKey(run, item)) {
      taken.add(item.key)
      ours.add(item.key)
    }
  }
  for (const key of run.existingKeys ?? []) {
    if (!ours.has(key) && !isCanonicalKitKey(key)) {
      taken.add(key)
    }
  }
  const keep = new Set<string>()
  for (const summary of summaries) {
    const id = `template:${summary.id}`
    keep.add(id)
    const previous = phase.items.find((item) => item.id === id)
    const key = keepsKey(run, previous)
      ? previous.key
      : deriveKey({
          base: summary.alias ?? summary.name,
          prefix: run.options.keyPrefix,
          taken,
          fallback: 'template',
        })
    const item = reconcileItem(phase, {
      id,
      kind: 'template',
      status: 'planned',
      name: summary.name,
      sourceId: summary.id,
      ...(summary.alias === null ? {} : { alias: summary.alias }),
      key,
    })
    if (item.status === 'done') {
      continue
    }
    item.key = key
    planTemplate(run, item, await loadTemplate(run, summary.id))
  }
  pruneItems(phase, keep)
  run.persist()
  if (run.apply) {
    for (const item of phase.items) {
      if (item.status !== 'planned' && item.status !== 'failed') {
        continue
      }
      run.ctx.signal.throwIfAborted()
      const template = await loadTemplate(run, item.sourceId ?? '')
      if (template?.html == null) {
        continue
      }
      const variables = template.variables.flatMap((variable) =>
        variable.fallbackValue === null || !VARIABLE_KEY.test(variable.key)
          ? []
          : [
              {
                key: variable.key,
                fallbackValue: variable.fallbackValue.slice(0, 1000),
              },
            ]
      )
      const from = parseFrom(template.from)
      await importAndSetUp(run, item, {
        body: {
          format: 'html',
          content: template.html,
          title: template.name.slice(0, 200),
          ...(template.subject === null
            ? {}
            : { subjectLine: template.subject }),
          placeholders: run.source.importPlaceholders,
          ...(variables.length === 0 ? {} : { variables }),
        },
        publish: template.status === 'published',
        ...(template.subject === null ? {} : { subject: template.subject }),
        ...(from === undefined ? {} : { from }),
      })
    }
  }
  settlePhase(phase, { apply: run.apply })
  if (summaries.length === 0 && phase.items.length === 0) {
    phase.detail = 'no templates in Resend'
  }
}

// ---- Report-only phases.

function reportOnly(
  run: RunContext,
  phase: PhaseState,
  items: readonly MigrationItem[],
  empty: string
): void {
  const keep = new Set(items.map((item) => item.id))
  for (const item of items) {
    const merged = reconcileItem(phase, item)
    merged.status = item.status
    if (item.detail !== undefined) {
      merged.detail = item.detail
    }
  }
  pruneItems(phase, keep)
  settlePhase(phase, { apply: run.apply })
  phase.detail = items.length === 0 ? empty : 'reported only: nothing is copied'
}

// ---- Broadcasts → Brew draft emails (nothing is sent).

export async function broadcastsPhase(run: RunContext): Promise<void> {
  const phase = phaseState(run, 'broadcasts')
  delete phase.error
  const inventory = inventoryOf(run)
  const broadcasts = await inventory.broadcasts()
  say(run, `Resend: ${broadcasts.length} broadcasts`)
  const audiences = new Map(
    (run.manifest.phases.segments?.items ?? []).flatMap((item) =>
      item.sourceId === undefined || item.brew?.audienceName === undefined
        ? []
        : [[item.sourceId, item.brew.audienceName] as const]
    )
  )
  const keep = new Set<string>()
  for (const broadcast of broadcasts) {
    const id = `broadcast:${broadcast.id}`
    keep.add(id)
    const item = reconcileItem(phase, {
      id,
      kind: 'broadcast',
      status: 'planned',
      name: broadcast.name,
      sourceId: broadcast.id,
    })
    if (item.status === 'done') {
      continue
    }
    if (broadcast.status === 'sent') {
      item.status = 'skipped'
      item.detail = 'sent; its history stays in Resend'
      continue
    }
    const audience =
      broadcast.segmentId === null
        ? undefined
        : audiences.get(broadcast.segmentId)
    item.status = 'planned'
    item.detail = `${broadcast.status} in Resend → a Brew draft email; nothing is sent${audience === undefined ? '' : `. Send it to the audience "${audience}" when ready`}`
  }
  pruneItems(phase, keep)
  run.persist()
  if (run.apply) {
    const brew = brewOf(run)
    for (const item of phase.items) {
      if (
        (item.status !== 'planned' && item.status !== 'failed') ||
        item.sourceId === undefined
      ) {
        continue
      }
      run.ctx.signal.throwIfAborted()
      try {
        const detail = await inventory.broadcast(item.sourceId)
        if (detail === null) {
          item.status = 'skipped'
          item.detail = 'no longer in Resend'
          continue
        }
        if (detail.html === null) {
          item.status = 'manual'
          item.detail = 'has no HTML body in Resend; write it in Brew'
          continue
        }
        const body = {
          format: 'html' as const,
          content: detail.html,
          title: detail.name.slice(0, 200),
          ...(detail.subject === null ? {} : { subjectLine: detail.subject }),
          placeholders: run.source.importPlaceholders,
        }
        say(run, `Importing broadcast ${item.name} as a Brew draft…`)
        const imported = (await brew.emails.import(
          asSdkInput<EmailImportInput>(body),
          {
            idempotencyKey: idempotencyKey(
              run,
              `broadcast-${item.sourceId}`,
              body
            ),
          }
        )) as unknown as ImportResponse
        item.warnings = []
        recordImportWarnings(item, imported)
        const triggerTags = (imported.variables ?? []).filter((variable) =>
          variable.path.startsWith('trigger.')
        )
        if (triggerTags.length > 0) {
          addWarning(item, {
            code: 'CAMPAIGN_TRIGGER_TAGS',
            message: `A campaign has no trigger payload, so ${triggerTags.map((variable) => `{{ ${variable.path} }}`).join(', ')} render${triggerTags.length === 1 ? 's' : ''} ${triggerTags.length === 1 ? 'its' : 'their'} fallback: point them at contact fields before sending.`,
          })
        }
        item.brew = { emailId: imported.emailId }
        item.status = 'done'
        item.detail = `draft email ${imported.emailId} in Brew (not sent)`
        delete item.error
      } catch (error) {
        rethrowIfFatal(run.ctx, error)
        item.status = 'failed'
        item.error = errorOf(run, error)
        if (looksLikeMissingImportModes(item.error)) {
          addWarning(item, {
            code: 'IMPORT_MODES_UNAVAILABLE',
            message:
              "Brew's import does not take the migration modes yet (placeholders); try again once it does.",
          })
        }
      }
      run.persist()
    }
  }
  settlePhase(phase, { apply: run.apply })
  if (broadcasts.length === 0 && phase.items.length === 0) {
    phase.detail = 'no broadcasts in Resend'
  }
}

export async function webhooksPhase(run: RunContext): Promise<void> {
  const webhooks = await inventoryOf(run).webhooks()
  reportOnly(
    run,
    phaseState(run, 'webhooks'),
    webhooks.map((webhook) => ({
      id: `webhook:${webhook.id}`,
      kind: 'webhook' as const,
      status: 'manual' as const,
      name: clean(run, webhook.endpointOrigin),
      sourceId: webhook.id,
      detail: `${webhook.status}, ${webhook.events.length} events (${webhook.events.slice(0, 4).join(', ')}${webhook.events.length > 4 ? ', …' : ''}): Brew does not post events to webhooks; read them with analytics events, and keep this one until Resend stops sending`,
    })),
    'no webhooks in Resend'
  )
}

export async function automationsPhase(run: RunContext): Promise<void> {
  const automations = await inventoryOf(run).automations()
  reportOnly(
    run,
    phaseState(run, 'automations'),
    automations.map((automation) => ({
      id: `automation:${automation.id}`,
      kind: 'automation' as const,
      status: 'manual' as const,
      name: automation.name,
      sourceId: automation.id,
      detail: `${automation.status} in Resend: rebuild it as a Brew automation (in the app, or with the Brew MCP)`,
    })),
    'no automations in Resend'
  )
}
