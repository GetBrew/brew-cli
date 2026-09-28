import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'
import { renderTable } from '../../lib/output'
import { rawRequest } from '../../lib/raw-request'

type EventCounts = Extract<
  operations['getEventsAnalytics']['responses'][200]['content']['application/json'],
  { groups: unknown }
>

/**
 * Grouped counts of the email events `analytics events` lists. Raw route
 * because `@brew.new/sdk` 10 has no method for it: once the CLI adopts SDK
 * 11.2, bind `analytics.eventCounts(...)` here and drop `isRawTransport`.
 */
export const analyticsEventCountsCommand = defineCommand({
  path: ['analytics', 'event-counts'],
  summary:
    'Count email events per field and/or period (clicks per link, events per day, unsubscribe reasons)',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/analytics/events' },
  commandClass: 'read',
  flags: [
    {
      flag: '--group-by <fields>',
      summary:
        'One or two comma-separated fields: eventType, emailId, automationId, sendId, source, link, recipientDomain, unsubscribeReason',
    },
    {
      flag: '--bucket <period>',
      summary: 'Count per UTC day, week (Monday start) or month',
    },
    { flag: '--since <datetime>', summary: 'Window start (ISO-8601)' },
    { flag: '--until <datetime>', summary: 'Window end (ISO-8601)' },
    {
      flag: '--event-type <type>',
      summary: 'Only one email event type (e.g. clicked)',
    },
    { flag: '--send-id <sendId>', summary: 'Only one send' },
    { flag: '--email-id <emailId>', summary: 'Only one design' },
    {
      flag: '--recipient <rules>',
      summary:
        'CSV of recipient rules (max 10): an address, @domain, or substring; prefix ! to exclude',
    },
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli analytics event-counts --send-id snd_123 --event-type clicked --group-by link',
    'brew-cli analytics event-counts --group-by eventType --bucket day',
    'brew-cli analytics event-counts --group-by unsubscribeReason --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      groupBy: flagString(flags.groupBy),
      bucket: flagString(flags.bucket),
      from: flagString(flags.since),
      to: flagString(flags.until),
      eventType: flagString(flags.eventType),
      sendId: flagString(flags.sendId),
      emailId: flagString(flags.emailId),
      recipient: flagString(flags.recipient),
    }) as Record<string, unknown>
    if (input.groupBy === undefined && input.bucket === undefined) {
      throw new CliUsageError(
        'Pass --group-by, --bucket, or both (`analytics events` lists the rows).'
      )
    }
    const query: Record<string, string | undefined> = {}
    for (const [key, value] of Object.entries(input)) {
      if (key === 'cursor' || key === 'limit') {
        continue
      }
      query[key] =
        value === undefined || value === null
          ? undefined
          : Array.isArray(value)
            ? value.map(String).join(',')
            : String(value)
    }
    const body = await rawRequest<EventCounts>(ctx, {
      method: 'GET',
      path: '/v1/analytics/events',
      query,
    })
    return { data: body, human: renderCounts(body) }
  },
})

function renderCounts(body: EventCounts): string {
  if (body.groups.length === 0) {
    return `No events counted (total ${body.count}).`
  }
  const rows = body.groups.map((group) => ({
    group: Object.entries(group.key ?? {})
      .map(([field, value]) => `${field}=${String(value)}`)
      .join(' '),
    ...(group.bucket === undefined ? {} : { bucket: group.bucket }),
    count: group.count,
  }))
  const table = renderTable(rows, [
    { key: 'group', header: 'GROUP' },
    ...(rows.some((row) => 'bucket' in row)
      ? [{ key: 'bucket', header: 'PERIOD' }]
      : []),
    { key: 'count', header: 'COUNT' },
  ])
  const footer = [
    `total ${body.count}`,
    body.otherCount > 0 ? `${body.otherCount} in unlisted groups` : '',
    body.truncated ? `truncated (counted from ${body.coveredFrom ?? '?'})` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  return `${table}\n${footer}`
}
