import type { EmailImportInput, UpsertManyContactRow } from '@brew.new/sdk'
import { asSdkInput } from '../input'
import {
  type ImportResponse,
  importAndSetUp,
  looksLikeMissingImportModes,
  recordImportWarnings,
} from './import-setup'
import { deriveKey, isCanonicalKitKey, slugifyKey } from './keys'
import type { MigrationItem, PhaseState } from './manifest'
import {
  addNextStep,
  addWarning,
  clean,
  errorOf,
  idempotencyKey,
  phaseState,
  pruneItems,
  type RunContext,
  reconcileItem,
  rethrowIfFatal,
  say,
  settlePhase,
} from './run'
import type { SourceContact, SourceTemplate } from './source'

/**
 * The account phases: what lives in the Resend account (domains, templates,
 * contacts, segments, suppressions) and what only gets reported (topics,
 * broadcasts, webhooks, automations). Each reads through the source's
 * inventory, plans items, and on `--apply` executes them, persisting the
 * manifest after every item or page so a re-run resumes.
 */

/** Pages a plan reads to count contacts or suppressions (100 rows each). */
const PLAN_COUNT_PAGES = 50
const CONTACT_FIELDS = new Set(['FIRST_NAME', 'LAST_NAME', 'EMAIL'])
const VARIABLE_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/
const CONSENT_EVIDENCE =
  'Subscribed in Resend (not unsubscribed) when migrated with brew-cli migrate resend'

function inventoryOf(run: RunContext) {
  const inventory = run.inventory
  if (inventory === undefined) {
    throw new Error('This phase reads Resend, and no Resend key was given.')
  }
  return inventory
}

function brewOf(run: RunContext) {
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
  const reuseKeys = run.manifest.options.keyPrefix === run.options.keyPrefix
  const taken = new Set<string>()
  const ours = new Set<string>()
  for (const item of [
    ...phase.items,
    ...(run.manifest.phases.code?.items ?? []),
  ]) {
    if (item.key !== undefined && (item.status === 'done' || reuseKeys)) {
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
    const key =
      previous?.key !== undefined && (previous.status === 'done' || reuseKeys)
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

// ---- Contacts.

function contactRow(contact: SourceContact): UpsertManyContactRow {
  const customFields =
    Object.keys(contact.properties).length === 0
      ? undefined
      : contact.properties
  return {
    email: contact.email,
    ...(contact.firstName === null ? {} : { firstName: contact.firstName }),
    ...(contact.lastName === null ? {} : { lastName: contact.lastName }),
    ...(customFields === undefined ? {} : { customFields }),
  }
}

function csvOf(emails: readonly string[]): string {
  const quote = (value: string): string =>
    /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
  return ['email', ...emails.map(quote)].join('\n')
}

function bump(
  state: { counts?: Record<string, number> },
  name: string,
  by: number
): void {
  const counts = state.counts ?? {}
  counts[name] = (counts[name] ?? 0) + by
  state.counts = counts
}

async function countPages<T>(
  read: (
    after: string | null
  ) => Promise<{ rows: readonly T[]; next: string | null }>,
  tally: (row: T) => void
): Promise<{ readonly truncated: boolean }> {
  let after: string | null = null
  for (let page = 0; page < PLAN_COUNT_PAGES; page += 1) {
    const result: { rows: readonly T[]; next: string | null } =
      await read(after)
    for (const row of result.rows) {
      tally(row)
    }
    if (result.next === null) {
      return { truncated: false }
    }
    after = result.next
  }
  return { truncated: true }
}

export async function contactsPhase(run: RunContext): Promise<void> {
  const phase = phaseState(run, 'contacts')
  delete phase.error
  const inventory = inventoryOf(run)
  if (!run.apply) {
    if (phase.status === 'done') {
      return
    }
    const counts: Record<string, number> = {}
    const { truncated } = await countPages(
      (after) => inventory.contacts(after),
      (contact) => {
        const bucket =
          contact.unsubscribed === null
            ? 'noConsentState'
            : contact.unsubscribed
              ? 'unsubscribed'
              : 'subscribed'
        counts[bucket] = (counts[bucket] ?? 0) + 1
      }
    )
    phase.counts = counts
    phase.status = 'planned'
    phase.detail = `${truncated ? `counted the first ${PLAN_COUNT_PAGES * 100}; ` : ''}subscribed contacts are upserted with an import consent record; unsubscribed ones stay unsubscribed${run.targetDomain === null ? '' : ` and join ${run.targetDomain.name}'s unsubscribe list`}; contacts without a subscription state are left out`
    say(
      run,
      `Resend: ${Object.values(counts).reduce((a, b) => a + b, 0)}${truncated ? '+' : ''} contacts`
    )
    return
  }
  if (phase.status === 'done') {
    return
  }
  const brew = brewOf(run)
  let after = phase.cursor ?? null
  if (after === null) {
    // A fresh apply: the plan's counts are estimates, not progress.
    phase.counts = {}
  }
  phase.status = 'partial'
  do {
    run.ctx.signal.throwIfAborted()
    const page = await inventory.contacts(after)
    const subscribed = page.rows.filter((row) => row.unsubscribed === false)
    const unsubscribed = page.rows.filter((row) => row.unsubscribed === true)
    const unknown = page.rows.length - subscribed.length - unsubscribed.length
    try {
      if (subscribed.length > 0) {
        const body = {
          contacts: subscribed.map(contactRow),
          consent: { source: 'import' as const, evidence: CONSENT_EVIDENCE },
        }
        const result = await brew.contacts.upsertMany(body, {
          idempotencyKey: idempotencyKey(
            run,
            `contacts-${after ?? 'start'}`,
            body
          ),
        })
        bump(
          phase,
          'upserted',
          result.summary.inserted + result.summary.updated
        )
        bump(phase, 'failed', result.summary.failed)
      }
      if (unsubscribed.length > 0) {
        const body = {
          contacts: unsubscribed.map((row) => ({
            ...contactRow(row),
            subscribed: false,
          })),
        }
        const result = await brew.contacts.upsertMany(body, {
          idempotencyKey: idempotencyKey(
            run,
            `contacts-unsub-${after ?? 'start'}`,
            body
          ),
        })
        bump(
          phase,
          'unsubscribed',
          result.summary.inserted + result.summary.updated
        )
        bump(phase, 'failed', result.summary.failed)
        if (run.targetDomain !== null) {
          const csv = csvOf(unsubscribed.map((row) => row.email))
          const imported = await brew.domains.unsubscribes.import(
            { domainId: run.targetDomain.domainId, csv },
            {
              idempotencyKey: idempotencyKey(
                run,
                `contacts-optout-${after ?? 'start'}`,
                csv
              ),
            }
          )
          bump(
            phase,
            'domainUnsubscribes',
            imported.summary.added + imported.summary.created
          )
        }
      }
    } catch (error) {
      rethrowIfFatal(run.ctx, error)
      phase.error = errorOf(run, error)
      phase.status = 'failed'
      phase.cursor = after
      run.persist()
      return
    }
    bump(phase, 'noConsentState', unknown)
    bump(phase, 'read', page.rows.length)
    after = page.next
    phase.cursor = after
    run.persist()
  } while (after !== null)
  phase.status = 'done'
  phase.cursor = null
  if ((phase.counts?.noConsentState ?? 0) > 0) {
    addWarning(phase, {
      code: 'NO_CONSENT_STATE',
      message: `${phase.counts?.noConsentState} contacts carried no subscription state in Resend and were left out.`,
    })
  }
  if ((phase.counts?.failed ?? 0) > 0) {
    addWarning(phase, {
      code: 'CONTACT_ROWS_FAILED',
      message: `${phase.counts?.failed} contact rows were refused by Brew (see the counts); the rest landed.`,
    })
  }
  run.persist()
}

// ---- Segments → a boolean contact field and an audience per segment.

/**
 * The audience selecting `fieldName = true`: the one named for the item, or
 * `<name> (Resend)` when a Brew audience of that name is not ours.
 */
async function ensureAudience(
  run: RunContext,
  item: MigrationItem,
  fieldName: string
): Promise<{ audienceId: string; audienceName: string }> {
  const brew = brewOf(run)
  const name = item.brew?.audienceName ?? item.name
  const existing = await brew.audiences.list({ search: name, limit: 100 })
  const rows =
    (
      existing as {
        data?: Array<{ audienceId: string; audienceName: string }>
      }
    ).data ?? []
  const match = rows.find((row) => row.audienceName === name)
  let audienceId = match?.audienceId
  let audienceName = name
  if (match !== undefined && item.brew?.audienceId !== match.audienceId) {
    audienceName = `${name} (Resend)`
    audienceId = rows.find(
      (row) => row.audienceName === audienceName
    )?.audienceId
  }
  if (audienceId === undefined) {
    const body = {
      name: audienceName,
      filters: {
        filters: [{ field: fieldName, operator: 'is_true' as const }],
        logicalOperator: 'and' as const,
      },
    }
    const created = await brew.audiences.create(body, {
      idempotencyKey: idempotencyKey(run, `audience-${item.id}`, body),
    })
    audienceId = (created as { audienceId: string }).audienceId
  }
  return { audienceId, audienceName }
}

export function segmentFieldName(name: string, taken: Set<string>): string {
  const slug = slugifyKey(name).replace(/[.-]/g, '_').slice(0, 40) || 'segment'
  let field = `resend_segment_${slug}`
  for (let n = 2; taken.has(field); n += 1) {
    field = `resend_segment_${slug}_${n}`
  }
  taken.add(field)
  return field
}

export async function segmentsPhase(run: RunContext): Promise<void> {
  const phase = phaseState(run, 'segments')
  delete phase.error
  const inventory = inventoryOf(run)
  const segments = await inventory.segments()
  say(run, `Resend: ${segments.length} segments`)
  const taken = new Set(
    phase.items.flatMap((item) =>
      item.brew?.fieldName === undefined ? [] : [item.brew.fieldName]
    )
  )
  const keep = new Set<string>()
  for (const segment of segments) {
    const id = `segment:${segment.id}`
    keep.add(id)
    const previous = phase.items.find((item) => item.id === id)
    const fieldName =
      previous?.brew?.fieldName ?? segmentFieldName(segment.name, taken)
    const item = reconcileItem(phase, {
      id,
      kind: 'segment',
      status: 'planned',
      name: segment.name,
      sourceId: segment.id,
      brew: { fieldName, audienceName: segment.name },
    })
    if (item.status !== 'done') {
      item.detail = `members get ${fieldName} = true; audience "${segment.name}" selects them`
    }
  }
  pruneItems(phase, keep)
  if (run.apply) {
    const brew = brewOf(run)
    for (const item of phase.items) {
      if (
        item.status === 'done' ||
        item.status === 'skipped' ||
        item.sourceId === undefined
      ) {
        continue
      }
      const fieldName = item.brew?.fieldName as string
      try {
        let after = item.cursor ?? null
        do {
          run.ctx.signal.throwIfAborted()
          const page = await inventory.segmentContacts(item.sourceId, after)
          if (page.rows.length > 0) {
            const body = {
              contacts: page.rows.map((row) => ({
                email: row.email,
                customFields: { [fieldName]: true },
                ...(row.unsubscribed === true ? { subscribed: false } : {}),
              })),
            }
            const result = await brew.contacts.upsertMany(body, {
              idempotencyKey: idempotencyKey(
                run,
                `segment-${item.sourceId}-${after ?? 'start'}`,
                body
              ),
            })
            bump(
              item,
              'members',
              result.summary.inserted + result.summary.updated
            )
            bump(item, 'failed', result.summary.failed)
          }
          after = page.next
          item.cursor = after
          run.persist()
        } while (after !== null)
        const { audienceId, audienceName } = await ensureAudience(
          run,
          item,
          fieldName
        )
        item.brew = { ...item.brew, audienceId, audienceName }
        item.status = 'done'
        item.detail = `${item.counts?.members ?? 0} members marked ${fieldName}; audience "${audienceName}"`
        delete item.error
      } catch (error) {
        rethrowIfFatal(run.ctx, error)
        item.status = 'failed'
        item.error = errorOf(run, error)
      }
      run.persist()
    }
  }
  settlePhase(phase, { apply: run.apply })
  if (segments.length === 0 && phase.items.length === 0) {
    phase.detail = 'no segments in Resend'
  }
}

// ---- Suppressions → the chosen Brew domain's unsubscribe list.

export async function suppressionsPhase(run: RunContext): Promise<void> {
  const phase = phaseState(run, 'suppressions')
  delete phase.error
  const inventory = inventoryOf(run)
  if (!run.apply) {
    if (phase.status === 'done') {
      return
    }
    const counts: Record<string, number> = {}
    const { truncated } = await countPages(
      (after) => inventory.suppressions(after),
      (row) => {
        counts[row.origin] = (counts[row.origin] ?? 0) + 1
      }
    )
    phase.counts = counts
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    phase.status =
      total === 0 ? 'skipped' : run.targetDomain === null ? 'manual' : 'planned'
    phase.detail =
      total === 0
        ? 'no suppressions in Resend'
        : run.targetDomain === null
          ? 'pass --domain <your Brew domain> to import them into its unsubscribe list'
          : `${truncated ? `counted the first ${PLAN_COUNT_PAGES * 100}; ` : ''}imported into ${run.targetDomain.name}'s unsubscribe list`
    if (total > 0 && run.targetDomain === null) {
      addNextStep(run, {
        id: 'suppressions-domain',
        actor: 'agent',
        kind: 'run-command',
        command: `${run.prefix} migrate resend --only suppressions --domain <brew-domain> --apply --yes`,
        title:
          "Import Resend suppressions into a Brew marketing domain's unsubscribe list (name the domain)",
        blocking: false,
      })
    }
    return
  }
  if (phase.status === 'done') {
    return
  }
  if (run.targetDomain === null) {
    phase.status = 'manual'
    phase.detail = 'pass --domain <your Brew domain> to import suppressions'
    addNextStep(run, {
      id: 'suppressions-domain',
      actor: 'agent',
      kind: 'run-command',
      command: `${run.prefix} migrate resend --only suppressions --domain <brew-domain> --apply --yes`,
      title:
        "Import Resend suppressions into a Brew marketing domain's unsubscribe list (name the domain)",
      blocking: false,
    })
    return
  }
  const brew = brewOf(run)
  const domain = run.targetDomain
  let after = phase.cursor ?? null
  if (after === null) {
    phase.counts = {}
  }
  phase.status = 'partial'
  do {
    run.ctx.signal.throwIfAborted()
    const page = await inventory.suppressions(after)
    try {
      if (page.rows.length > 0) {
        const csv = csvOf(page.rows.map((row) => row.email))
        const result = await brew.domains.unsubscribes.import(
          { domainId: domain.domainId, csv },
          {
            idempotencyKey: idempotencyKey(
              run,
              `suppressions-${after ?? 'start'}`,
              csv
            ),
          }
        )
        bump(phase, 'added', result.summary.added + result.summary.created)
        bump(phase, 'alreadyUnsubscribed', result.summary.alreadyUnsubscribed)
        bump(phase, 'skipped', result.summary.skipped)
      }
    } catch (error) {
      rethrowIfFatal(run.ctx, error)
      phase.error = errorOf(run, error)
      phase.status = 'failed'
      phase.cursor = after
      run.persist()
      return
    }
    bump(phase, 'read', page.rows.length)
    after = page.next
    phase.cursor = after
    run.persist()
  } while (after !== null)
  phase.status = 'done'
  phase.cursor = null
  phase.detail = `imported into ${domain.name}'s unsubscribe list`
  run.persist()
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

// ---- Topics → a boolean contact field (opted in) and an audience per topic.

export function topicFieldName(name: string, taken: Set<string>): string {
  const slug = slugifyKey(name).replace(/[.-]/g, '_').slice(0, 40) || 'topic'
  let field = `resend_topic_${slug}`
  for (let n = 2; taken.has(field); n += 1) {
    field = `resend_topic_${slug}_${n}`
  }
  taken.add(field)
  return field
}

/** Minutes to read `contacts` choices one request each at `rate` per second. */
function minutesFor(contacts: number, rate: number): number {
  return Math.max(1, Math.ceil(contacts / Math.max(0.1, rate) / 60))
}

export async function topicsPhase(run: RunContext): Promise<void> {
  const phase = phaseState(run, 'topics')
  delete phase.error
  const inventory = inventoryOf(run)
  const topics = await inventory.topics()
  say(run, `Resend: ${topics.length} topics`)
  const taken = new Set(
    phase.items.flatMap((item) =>
      item.brew?.fieldName === undefined ? [] : [item.brew.fieldName]
    )
  )
  const keep = new Set<string>()
  for (const topic of topics) {
    const id = `topic:${topic.id}`
    keep.add(id)
    const previous = phase.items.find((item) => item.id === id)
    const fieldName =
      previous?.brew?.fieldName ?? topicFieldName(topic.name, taken)
    const item = reconcileItem(phase, {
      id,
      kind: 'topic',
      status: 'planned',
      name: topic.name,
      sourceId: topic.id,
      brew: { fieldName, audienceName: `${topic.name} (topic)` },
    })
    if (item.status !== 'done') {
      item.detail = `each contact's choice becomes ${fieldName} (true = opted in; Resend default ${topic.defaultSubscription ?? 'unknown'}); audience "${topic.name} (topic)" selects the opted-in`
    }
  }
  pruneItems(phase, keep)
  if (topics.length === 0) {
    settlePhase(phase, { apply: run.apply })
    phase.detail = 'no topics in Resend'
    return
  }
  const known = run.manifest.phases.contacts?.counts
  // The contacts phase's counts: the plan's estimate, or what an apply read.
  const contacts =
    known === undefined
      ? null
      : (known.subscribed ?? known.upserted ?? 0) + (known.unsubscribed ?? 0)
  const rate = run.source.rateLimit.requestsPerSecond
  if (!run.apply) {
    settlePhase(phase, { apply: false })
    phase.detail = `reads each contact's topic choices: one ${run.source.displayName} request per contact${contacts === null || contacts === 0 ? '' : ` (about ${minutesFor(contacts, rate)} min for ${contacts} contacts at ${rate}/s)`}; resumable`
    return
  }
  const brew = brewOf(run)
  const fieldByTopic = new Map(
    phase.items.flatMap((item) =>
      item.sourceId === undefined || item.brew?.fieldName === undefined
        ? []
        : [[item.sourceId, item.brew.fieldName] as const]
    )
  )
  // Pass 1: every contact's choices onto its record, page by page.
  if (phase.counts?.passComplete !== 1) {
    let after = phase.cursor ?? null
    if (after === null) {
      phase.counts = {}
    }
    try {
      do {
        run.ctx.signal.throwIfAborted()
        const page = await inventory.contacts(after)
        const rows: UpsertManyContactRow[] = []
        for (const contact of page.rows) {
          // A contact with no subscription state never reaches Brew.
          if (contact.unsubscribed === null) {
            continue
          }
          const choices = await inventory.contactTopics(contact.id)
          const customFields: Record<string, boolean> = {}
          for (const choice of choices) {
            const field = fieldByTopic.get(choice.topicId)
            if (field !== undefined) {
              customFields[field] = choice.subscribed
            }
          }
          if (Object.keys(customFields).length === 0) {
            continue
          }
          rows.push({
            email: contact.email,
            customFields,
            ...(contact.unsubscribed ? { subscribed: false } : {}),
          })
        }
        if (rows.length > 0) {
          const body = { contacts: rows }
          const result = await brew.contacts.upsertMany(body, {
            idempotencyKey: idempotencyKey(
              run,
              `topics-${after ?? 'start'}`,
              body
            ),
          })
          bump(
            phase,
            'contacts',
            result.summary.inserted + result.summary.updated
          )
          bump(phase, 'failed', result.summary.failed)
        }
        bump(phase, 'read', page.rows.length)
        after = page.next
        phase.cursor = after
        run.persist()
      } while (after !== null)
    } catch (error) {
      rethrowIfFatal(run.ctx, error)
      phase.error = errorOf(run, error)
      phase.status = 'failed'
      run.persist()
      return
    }
    bump(phase, 'passComplete', 1)
    phase.cursor = null
    run.persist()
  }
  // Pass 2: one audience per topic.
  for (const item of phase.items) {
    if (item.status === 'done' || item.brew?.fieldName === undefined) {
      continue
    }
    try {
      const { audienceId, audienceName } = await ensureAudience(
        run,
        item,
        item.brew.fieldName
      )
      item.brew = { ...item.brew, audienceId, audienceName }
      item.status = 'done'
      item.detail = `${item.brew.fieldName} on every contact with a choice; audience "${audienceName}"`
      delete item.error
    } catch (error) {
      rethrowIfFatal(run.ctx, error)
      item.status = 'failed'
      item.error = errorOf(run, error)
    }
    run.persist()
  }
  settlePhase(phase, { apply: true })
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
