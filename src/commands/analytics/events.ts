import type { EventsAnalyticsInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import {
  asSdkInput,
  flagInt,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'
import { renderTable } from '../../lib/output'
import {
  ALL_FLAG,
  CURSOR_FLAG,
  collectAll,
  LIMIT_FLAG,
} from '../../lib/paginate'

export const analyticsEventsCommand = defineCommand({
  path: ['analytics', 'events'],
  summary: 'Unified event explorer (email, automation, trigger, inbound)',
  sdkMethod: 'analytics.events',
  route: { method: 'GET', path: '/v1/analytics/events' },
  commandClass: 'read',
  flags: [
    { flag: '--since <datetime>', summary: 'Window start (ISO-8601)' },
    { flag: '--until <datetime>', summary: 'Window end (ISO-8601)' },
    { flag: '--recipient <email>', summary: 'Filter by recipient email' },
    {
      flag: '--event-type <type>',
      summary: 'Filter by event type (e.g. opened, clicked)',
    },
    { flag: '--automation <automationId>', summary: 'Filter by automation' },
    { flag: '--send <sendId>', summary: 'Filter by campaign send' },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli analytics events --since 2026-08-01 --event-type clicked',
    'brew-cli analytics events --recipient jane@example.com --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      from: flagString(flags.since),
      to: flagString(flags.until),
      recipientEmail: flagString(flags.recipient),
      eventType: flagString(flags.eventType),
      automationId: flagString(flags.automation),
      sendId: flagString(flags.send),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const analytics = ctx.client().analytics
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        analytics.events(
          asSdkInput<EventsAnalyticsInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderEvents(rows),
      }
    }
    const result = await analytics.events(
      asSdkInput<EventsAnalyticsInput>(input)
    )
    return { data: result, human: renderEvents(result.data) }
  },
})

function renderEvents(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No events matched.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'occurredAt', header: 'OCCURRED' },
    { key: 'domain', header: 'DOMAIN' },
    { key: 'eventType', header: 'EVENT' },
    { key: 'recipientEmail', header: 'RECIPIENT' },
  ])
}
