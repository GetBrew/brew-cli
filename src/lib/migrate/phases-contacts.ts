import type { UpsertManyContactRow } from '@brew.new/sdk'
import { slugifyKey } from './keys'
import type { MigrationItem } from './manifest'
import { brewOf, inventoryOf } from './phases'
import {
  addNextStep,
  addWarning,
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
import type { SourceContact } from './source'

/**
 * The contact phases: contacts, segments, suppressions and topics, read
 * page by page from the source into Brew contacts, audiences and a domain's
 * unsubscribe list. Each page persists its cursor, so a re-run resumes.
 */

/** Pages a plan reads to count contacts or suppressions (100 rows each). */
const PLAN_COUNT_PAGES = 50
const IMPORT_CONSENT = {
  source: 'import' as const,
  evidence:
    'Subscribed in Resend (not unsubscribed) when migrated with brew-cli migrate resend',
}

/** A contact's state as the contacts phase writes it: consent, or unsubscribed. */
function subscription(contact: SourceContact) {
  return contact.unsubscribed === true
    ? { subscribed: false }
    : { consent: IMPORT_CONSENT }
}

/** Rows Brew refused: the next run reads every page again to retry them. */
function refusedRows(failed: number): { code: string; message: string } {
  return {
    code: 'CONTACT_ROWS_FAILED',
    message: `Brew refused ${failed} contact rows (see the counts); fix those contacts in Resend, then run again to retry them.`,
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
  // Opt-outs join the --domain's unsubscribe list: while the Brew domain
  // list cannot be read, contacts wait rather than finish without them.
  if (
    run.targetDomain === null &&
    (run.options.domain ?? run.manifest.options.domain) != null
  ) {
    run.findings.push({
      code: 'CONTACTS_WAIT_FOR_DOMAIN',
      severity: 'error',
      message:
        'Contacts were not moved: their opt-outs join the --domain unsubscribe list, and the Brew domains could not be read. Run the migration again.',
    })
    return
  }
  const brew = brewOf(run)
  let after = phase.cursor ?? null
  if (after === null) {
    // A fresh apply: the plan's counts are estimates, not progress.
    phase.counts = {}
    phase.warnings = []
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
          consent: IMPORT_CONSENT,
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
  phase.cursor = null
  const failed = phase.counts?.failed ?? 0
  if (failed > 0) {
    phase.status = 'partial'
    phase.error = refusedRows(failed)
  } else {
    phase.status = 'done'
  }
  if ((phase.counts?.noConsentState ?? 0) > 0) {
    addWarning(phase, {
      code: 'NO_CONSENT_STATE',
      message: `${phase.counts?.noConsentState} contacts carried no subscription state in Resend and were left out.`,
    })
  }
  run.persist()
}

// ---- Segments → a boolean contact field and an audience per segment.

/**
 * The audience selecting `fieldName = true`: the one named for the item, or
 * `<name> (Resend)` when a Brew audience of that name selects something
 * else. An existing audience is reused only when it selects exactly that.
 */
async function ensureAudience(
  run: RunContext,
  item: MigrationItem,
  fieldName: string
): Promise<{ audienceId: string; audienceName: string }> {
  const brew = brewOf(run)
  const name = item.brew?.audienceName ?? item.name
  const existing = await brew.audiences.list({ search: name, limit: 100 })
  const rows = existing.data
  const selectsField = (row: (typeof rows)[number]): boolean =>
    row.filters.filters.length === 1 &&
    row.filters.filters[0]?.field === fieldName &&
    row.filters.filters[0]?.operator === 'is_true'
  let audienceName = name
  let match = rows.find((row) => row.audienceName === audienceName)
  if (match !== undefined && !selectsField(match)) {
    audienceName = `${name} (Resend)`
    match = rows.find((row) => row.audienceName === audienceName)
    if (match !== undefined && !selectsField(match)) {
      throw new Error(
        `Brew audiences "${name}" and "${audienceName}" both select other contacts; rename one, then run again.`
      )
    }
  }
  let audienceId = match?.audienceId
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
        if (after === null) {
          item.counts = {}
        }
        do {
          run.ctx.signal.throwIfAborted()
          const page = await inventory.segmentContacts(item.sourceId, after)
          // As in the contacts phase: no subscription state, no Brew contact.
          const rows = page.rows.filter((row) => row.unsubscribed !== null)
          if (rows.length > 0) {
            const body = {
              contacts: rows.map((row) => ({
                email: row.email,
                customFields: { [fieldName]: true },
                ...subscription(row),
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
        const failed = item.counts?.failed ?? 0
        if (failed > 0) {
          item.status = 'failed'
          item.error = refusedRows(failed)
        } else {
          const { audienceId, audienceName } = await ensureAudience(
            run,
            item,
            fieldName
          )
          item.brew = { ...item.brew, audienceId, audienceName }
          item.status = 'done'
          item.detail = `${item.counts?.members ?? 0} members marked ${fieldName}; audience "${audienceName}"`
          delete item.error
        }
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
    if (previous === undefined) {
      // A topic the contact pass has not read: the pass starts over.
      phase.cursor = null
      delete phase.counts?.passComplete
    }
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
            ...subscription(contact),
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
    phase.cursor = null
    const failed = phase.counts?.failed ?? 0
    if (failed > 0) {
      phase.error = refusedRows(failed)
      phase.status = 'failed'
      run.persist()
      return
    }
    bump(phase, 'passComplete', 1)
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
