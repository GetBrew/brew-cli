import type {
  CountContactsByInput,
  CountContactsByResponse,
} from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  INPUT_FLAG,
  mergeInput,
  parseFilterFlags,
  readJsonFlag,
} from '../../lib/input'
import { renderTable } from '../../lib/output'

/**
 * Exact contact counts per field value, per email domain, or per signup
 * period — the grouped form of `contacts count`, which returns only the
 * total.
 */
export const contactsCountByCommand = defineCommand({
  path: ['contacts', 'count-by'],
  summary:
    'Count contacts per field value, email domain, or signup period (largest group first)',
  sdkMethod: 'contacts.countBy',
  route: { method: 'POST', path: '/v1/contacts/search' },
  commandClass: 'read',
  flags: [
    {
      flag: '--group-by <fields>',
      summary:
        'One or two comma-separated fields: a contact field, a custom field, or emailDomain',
    },
    {
      flag: '--bucket <period>',
      summary: 'Count per UTC day, week or month of createdAt',
    },
    { flag: '--search <text>', summary: 'Free-text search' },
    {
      flag: '--filter <filters...>',
      summary: 'Structured filter field:operator[:value], repeatable',
    },
    { flag: '--audience <audienceId>', summary: 'Scope to one audience' },
    { flag: '--logic <logic>', summary: 'Filter combinator: and | or' },
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli contacts count-by --group-by emailDomain',
    'brew-cli contacts count-by --bucket month --filter subscribed:equals:true',
    'brew-cli contacts count-by --group-by country,plan --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      groupBy: flagString(flags.groupBy),
      bucket: flagString(flags.bucket),
      search: flagString(flags.search),
      filters: parseFilterFlags(flags.filter),
      audienceId: flagString(flags.audience),
      logic: flagString(flags.logic),
    })
    if (input.groupBy === undefined && input.bucket === undefined) {
      throw new CliUsageError(
        'Pass --group-by, --bucket, or both (`contacts count` gives the total alone).'
      )
    }
    const body = await ctx.client().contacts.countBy(
      asSdkInput<CountContactsByInput>({
        ...input,
        ...(input.groupBy === undefined
          ? {}
          : { groupBy: toFieldList(input.groupBy) }),
      })
    )
    return { data: body, human: renderCounts(body) }
  },
})

/**
 * `--group-by country,plan` (or a `groupBy` string in --input) becomes the
 * field list; an array from --input passes through. The API validates the
 * fields and how many.
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

function renderCounts(body: CountContactsByResponse): string {
  const groups = body.groups ?? []
  if (groups.length === 0) {
    return `No contacts counted (total ${body.count}).`
  }
  const rows = groups.map((group) => ({
    group: Object.entries(group.key)
      .map(([field, value]) => `${field}=${String(value)}`)
      .join(' '),
    ...(group.bucket === undefined || group.bucket === null
      ? {}
      : { bucket: group.bucket }),
    count: group.count,
  }))
  const table = renderTable(rows, [
    { key: 'group', header: 'GROUP' },
    ...(rows.some((row) => 'bucket' in row)
      ? [{ key: 'bucket', header: 'PERIOD' }]
      : []),
    { key: 'count', header: 'COUNT' },
  ])
  const otherCount = body.otherCount ?? 0
  const footer = [
    `total ${body.count}`,
    otherCount > 0 ? `${otherCount} in unlisted groups` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  return `${table}\n${footer}`
}
