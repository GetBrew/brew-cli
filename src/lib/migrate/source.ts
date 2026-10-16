import type { Clock } from '../clock'
import type { CliContext } from '../types'
import type { CodeScan, CodeScanOptions } from './code/scan'

/**
 * A provider a project migrates from. Resend is the only one registered;
 * the pipeline reads everything through this interface, so another source
 * is a new implementation, not a new pipeline.
 */

export type SourceDomain = {
  readonly id: string
  readonly name: string
  readonly status: string
  readonly region: string | null
}

export type SourceTemplateSummary = {
  readonly id: string
  readonly name: string
  readonly alias: string | null
  readonly status: string
}

export type SourceVariable = {
  readonly key: string
  readonly type: string
  readonly fallbackValue: string | null
}

export type SourceTemplate = SourceTemplateSummary & {
  readonly html: string | null
  readonly subject: string | null
  readonly from: string | null
  readonly variables: readonly SourceVariable[]
}

export type SourceContact = {
  /** The source's own id: the resume cursor. */
  readonly id: string
  readonly email: string
  readonly firstName: string | null
  readonly lastName: string | null
  /** null when the source says nothing about consent. */
  readonly unsubscribed: boolean | null
  readonly properties: Readonly<Record<string, string | number | boolean>>
}

export type SourceSegment = { readonly id: string; readonly name: string }

export type SourceTopic = {
  readonly id: string
  readonly name: string
  readonly defaultSubscription: string | null
}

export type SourceSuppression = {
  readonly id: string
  readonly email: string
  readonly origin: string
}

export type SourceBroadcast = {
  readonly id: string
  readonly name: string
  readonly status: string
  readonly segmentId: string | null
}

export type SourceBroadcastDetail = SourceBroadcast & {
  readonly html: string | null
  readonly subject: string | null
}

/** One contact's choice for one topic. */
export type SourceTopicChoice = {
  readonly topicId: string
  readonly subscribed: boolean
}

export type SourceWebhook = {
  readonly id: string
  /** Origin only: a path or query can carry a token. */
  readonly endpointOrigin: string
  readonly events: readonly string[]
  readonly status: string
}

export type SourceAutomation = {
  readonly id: string
  readonly name: string
  readonly status: string
}

export type Page<T> = {
  readonly rows: readonly T[]
  /** Pass to the next call; null when this was the last page. */
  readonly next: string | null
}

/** Reads one account. Every call is paced to the source's rate limit. */
export type SourceInventory = {
  readonly domains: () => Promise<SourceDomain[]>
  readonly templates: () => Promise<SourceTemplateSummary[]>
  readonly template: (id: string) => Promise<SourceTemplate | null>
  readonly contacts: (after: string | null) => Promise<Page<SourceContact>>
  readonly segments: () => Promise<SourceSegment[]>
  readonly segmentContacts: (
    segmentId: string,
    after: string | null
  ) => Promise<Page<SourceContact>>
  readonly topics: () => Promise<SourceTopic[]>
  readonly suppressions: (
    after: string | null
  ) => Promise<Page<SourceSuppression>>
  readonly broadcasts: () => Promise<SourceBroadcast[]>
  readonly broadcast: (id: string) => Promise<SourceBroadcastDetail | null>
  /** One request per contact: the source keeps topic choices per contact. */
  readonly contactTopics: (contactId: string) => Promise<SourceTopicChoice[]>
  readonly webhooks: () => Promise<SourceWebhook[]>
  readonly automations: () => Promise<SourceAutomation[]>
  readonly requestCount: () => number
}

export type MigrationSource = {
  readonly id: 'resend'
  readonly displayName: string
  /** The environment variable the source's API key is read from. */
  readonly envKey: string
  readonly rateLimit: { readonly requestsPerSecond: number }
  /** The `placeholders` mode `POST /v1/emails/import` converts its templates with. */
  readonly importPlaceholders: 'resend'
  readonly inventory: (
    ctx: Pick<CliContext, 'signal' | 'budget' | 'io'>,
    input: { readonly apiKey: string; readonly clock?: Clock }
  ) => SourceInventory
  readonly scanCode: (root: string, options?: CodeScanOptions) => CodeScan
}
