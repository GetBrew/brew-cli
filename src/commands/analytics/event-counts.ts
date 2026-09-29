import type { EventCountsInput, EventCountsResponse } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'
import { renderTable } from '../../lib/output'

/**
 * Keys the events read takes for a page of ROWS that a grouped count
 * refuses, with the API's own reason. The SDK does not send them, so they
 * are refused here rather than silently dropped. (`limit` only sizes a page
 * and a count ignores it, as the API does.)
 */
const ROW_ONLY_KEYS: Readonly<Record<string, string>> = {
  cursor: 'A grouped count is not paged; drop `cursor`.',
  automationRunId:
    '`groupBy` and `bucket` count email events and do not combine with `automationRunId`.',
}

/** Grouped counts of the email events `analytics events` lists. */
export const analyticsEventCountsCommand = defineCommand({
  path: ['analytics', 'event-counts'],
  summary:
    'Count email events per field and/or period (clicks per link, events per day, unsubscribe reasons)',
  sdkMethod: 'analytics.eventCounts',
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
    })
    if (input.groupBy === undefined && input.bucket === undefined) {
      throw new CliUsageError(
        'Pass --group-by, --bucket, or both (`analytics events` lists the rows).'
      )
    }
    for (const [key, reason] of Object.entries(ROW_ONLY_KEYS)) {
      if (input[key] !== undefined) {
        throw new CliUsageError(reason)
      }
    }
    const { limit: _pageSize, ...counted } = input
    const body = await ctx.client().analytics.eventCounts(
      asSdkInput<EventCountsInput>({
        ...counted,
        ...(counted.groupBy === undefined
          ? {}
          : { groupBy: toFieldList(counted.groupBy) }),
      })
    )
    return { data: body, human: renderCounts(body) }
  },
})

/**
 * `--group-by eventType,link` (or a `groupBy` string in --input) becomes the
 * field list the SDK sends; an array from --input passes through. The API
 * validates the fields and how many.
 */
function toFieldList(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }
  return value
    .split(',')
    .map((field) => field.trim())
    .filter((field) => field !== '')
}

function renderCounts(body: EventCountsResponse): string {
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
