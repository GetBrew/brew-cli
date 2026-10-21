import { scanProject } from '../code/scan'
import type {
  MigrationSource,
  Page,
  SourceBroadcast,
  SourceContact,
  SourceInventory,
  SourceSuppression,
} from '../source'
import { createResendClient, type ResendClient } from './client'

/**
 * Resend as a migration source: the current API (contacts are global,
 * audiences became segments, topics hold subscription preferences,
 * templates carry their variables), read page by page with `after`
 * cursors so an interrupted run resumes where it stopped.
 */

type Row = Readonly<Record<string, unknown>>

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function contactOf(row: Row): SourceContact | null {
  const id = text(row.id)
  const email = text(row.email)
  if (id === null || email === null) {
    return null
  }
  const properties: Record<string, string | number | boolean> = {}
  const raw = row.properties
  if (typeof raw === 'object' && raw !== null) {
    for (const [key, entry] of Object.entries(raw as Row)) {
      const value =
        typeof entry === 'object' && entry !== null
          ? (entry as { value?: unknown }).value
          : entry
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        properties[key] = value
      }
    }
  }
  return {
    id,
    email,
    firstName: text(row.first_name),
    lastName: text(row.last_name),
    unsubscribed:
      typeof row.unsubscribed === 'boolean' ? row.unsubscribed : null,
    properties,
  }
}

/** Every page of a list endpoint that returns all rows when asked for pages. */
async function listAll(client: ResendClient, path: string): Promise<Row[]> {
  const rows: Row[] = []
  let after: string | undefined
  for (let pageCount = 0; pageCount < 1000; pageCount += 1) {
    const page = await client.page<Row>(
      path,
      after === undefined ? {} : { after }
    )
    rows.push(...page.data)
    const last = text(page.data.at(-1)?.id)
    if (!page.hasMore || last === null) {
      break
    }
    after = last
  }
  return rows
}

async function contactPage(
  client: ResendClient,
  path: string,
  after: string | null
): Promise<Page<SourceContact>> {
  const page = await client.page<Row>(path, after === null ? {} : { after })
  const rows = page.data
    .map(contactOf)
    .filter((row): row is SourceContact => row !== null)
  const last = text(page.data.at(-1)?.id)
  return { rows, next: page.hasMore && last !== null ? last : null }
}

function endpointOrigin(value: unknown): string {
  try {
    return new URL(String(value)).origin
  } catch {
    return 'an invalid URL'
  }
}

export const resendSource: MigrationSource = {
  id: 'resend',
  displayName: 'Resend',
  envKey: 'RESEND_API_KEY',
  rateLimit: { requestsPerSecond: 2 },
  importPlaceholders: 'resend',
  scanCode: (root, options) => scanProject(root, options),
  inventory: (ctx, input): SourceInventory => {
    const client = createResendClient(ctx, {
      apiKey: input.apiKey,
      requestsPerSecond: resendSource.rateLimit.requestsPerSecond,
      ...(input.clock === undefined ? {} : { clock: input.clock }),
    })
    return {
      requestCount: client.requestCount,
      domains: async () =>
        (await listAll(client, '/domains')).flatMap((row) => {
          const id = text(row.id)
          const name = text(row.name)
          return id === null || name === null
            ? []
            : [
                {
                  id,
                  name,
                  status: text(row.status) ?? 'unknown',
                  region: text(row.region),
                },
              ]
        }),
      templates: async () =>
        (await listAll(client, '/templates')).flatMap((row) => {
          const id = text(row.id)
          return id === null
            ? []
            : [
                {
                  id,
                  name: text(row.name) ?? id,
                  alias: text(row.alias),
                  status: text(row.status) ?? 'unknown',
                },
              ]
        }),
      template: async (id) => {
        const row = (await client.get(
          `/templates/${encodeURIComponent(id)}`
        )) as Row | undefined
        if (row === undefined || row === null || typeof row !== 'object') {
          return null
        }
        const variables = Array.isArray(row.variables)
          ? (row.variables as Row[])
          : []
        const from = row.from
        return {
          id,
          name: text(row.name) ?? id,
          alias: text(row.alias),
          status: text(row.status) ?? 'unknown',
          html: text(row.html),
          subject: text(row.subject),
          from:
            typeof from === 'string'
              ? text(from)
              : typeof from === 'object' && from !== null
                ? formatFrom(from as Row)
                : null,
          variables: variables.flatMap((variable) => {
            const key = text(variable.key)
            const fallback = variable.fallback_value
            return key === null
              ? []
              : [
                  {
                    key,
                    type: text(variable.type) ?? 'string',
                    fallbackValue:
                      fallback === null || fallback === undefined
                        ? null
                        : String(fallback),
                  },
                ]
          }),
        }
      },
      contacts: (after) => contactPage(client, '/contacts', after),
      segments: async () =>
        (await listAll(client, '/segments')).flatMap((row) => {
          const id = text(row.id)
          return id === null ? [] : [{ id, name: text(row.name) ?? id }]
        }),
      segmentContacts: (segmentId, after) =>
        contactPage(
          client,
          `/segments/${encodeURIComponent(segmentId)}/contacts`,
          after
        ),
      topics: async () =>
        (await listAll(client, '/topics')).flatMap((row) => {
          const id = text(row.id)
          return id === null
            ? []
            : [
                {
                  id,
                  name: text(row.name) ?? id,
                  defaultSubscription: text(row.default_subscription),
                },
              ]
        }),
      suppressions: async (after): Promise<Page<SourceSuppression>> => {
        const page = await client.page<Row>(
          '/suppressions',
          after === null ? {} : { after }
        )
        const rows = page.data.flatMap((row) => {
          const id = text(row.id)
          const email = text(row.email)
          return id === null || email === null
            ? []
            : [{ id, email, origin: text(row.origin) ?? 'manual' }]
        })
        const last = text(page.data.at(-1)?.id)
        return { rows, next: page.hasMore && last !== null ? last : null }
      },
      broadcasts: async () =>
        (await listAll(client, '/broadcasts')).flatMap((row) => {
          const broadcast = broadcastOf(row)
          return broadcast === null ? [] : [broadcast]
        }),
      broadcast: async (id) => {
        const row = (await client.get(
          `/broadcasts/${encodeURIComponent(id)}`
        )) as Row | undefined
        const broadcast =
          row === undefined || row === null || typeof row !== 'object'
            ? null
            : broadcastOf(row)
        return broadcast === null
          ? null
          : {
              ...broadcast,
              html: text((row as Row).html),
              subject: text((row as Row).subject),
            }
      },
      contactTopics: async (contactId) => {
        const choices: Array<{ topicId: string; subscribed: boolean }> = []
        let after: string | undefined
        for (let pageCount = 0; pageCount < 20; pageCount += 1) {
          const page = await client.page<Row>(
            `/contacts/${encodeURIComponent(contactId)}/topics`,
            after === undefined ? {} : { after }
          )
          for (const row of page.data) {
            const topicId = text(row.id)
            const subscription = text(row.subscription)
            if (
              topicId !== null &&
              (subscription === 'opt_in' || subscription === 'opt_out')
            ) {
              choices.push({ topicId, subscribed: subscription === 'opt_in' })
            }
          }
          const last = text(page.data.at(-1)?.id)
          if (!page.hasMore || last === null) {
            break
          }
          after = last
        }
        return choices
      },
      webhooks: async () =>
        (await listAll(client, '/webhooks')).flatMap((row) => {
          const id = text(row.id)
          return id === null
            ? []
            : [
                {
                  id,
                  endpointOrigin: endpointOrigin(row.endpoint),
                  events: Array.isArray(row.events)
                    ? row.events.filter(
                        (event): event is string => typeof event === 'string'
                      )
                    : [],
                  status: text(row.status) ?? 'unknown',
                },
              ]
        }),
      automations: async () =>
        (await listAll(client, '/automations')).flatMap((row) => {
          const id = text(row.id)
          return id === null
            ? []
            : [
                {
                  id,
                  name: text(row.name) ?? id,
                  status: text(row.status) ?? 'unknown',
                },
              ]
        }),
    }
  },
}

function broadcastOf(row: Row): SourceBroadcast | null {
  const id = text(row.id)
  return id === null
    ? null
    : {
        id,
        name: text(row.name) ?? id,
        status: text(row.status) ?? 'unknown',
        segmentId: text(row.segment_id) ?? text(row.audience_id),
      }
}

function formatFrom(from: Row): string | null {
  const email = text(from.email) ?? text(from.address)
  if (email === null) {
    return null
  }
  const name = text(from.name)
  return name === null ? email : `${name} <${email}>`
}

/** The registered sources, by command name. Resend only. */
export const MIGRATION_SOURCES = { resend: resendSource } as const
