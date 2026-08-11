import type { ListSendsInput } from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import {
  asSdkInput,
  flagInt,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../../lib/input'
import { renderTable } from '../../../lib/output'
import {
  ALL_FLAG,
  CURSOR_FLAG,
  collectAll,
  LIMIT_FLAG,
} from '../../../lib/paginate'

export const analyticsSendsListCommand = defineCommand({
  path: ['analytics', 'sends', 'list'],
  summary: 'List campaign/automation sends with delivery stats',
  sdkMethod: 'analytics.sends.list',
  route: { method: 'GET', path: '/v1/analytics/sends' },
  commandClass: 'read',
  flags: [
    { flag: '--send <sendId>', summary: 'Fetch one send (single-row page)' },
    { flag: '--email <emailId>', summary: 'Filter by email design' },
    {
      flag: '--include <tokens>',
      summary: 'Comma-separated expansions: events',
    },
    {
      flag: '--status <status>',
      summary: 'scheduled | queued | sending | sent | failed | canceled',
    },
    { flag: '--since <datetime>', summary: 'Window start (ISO-8601)' },
    { flag: '--until <datetime>', summary: 'Window end (ISO-8601)' },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli analytics sends list --status sent',
    'brew-cli analytics sends list --email em_123 --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      sendId: flagString(flags.send),
      emailId: flagString(flags.email),
      include: flagString(flags.include),
      status: flagString(flags.status),
      from: flagString(flags.since),
      to: flagString(flags.until),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const sends = ctx.client().analytics.sends
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        sends.list(
          asSdkInput<ListSendsInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderSends(rows),
      }
    }
    const result = await sends.list(asSdkInput<ListSendsInput>(input))
    return { data: result, human: renderSends(result.data) }
  },
})

function renderSends(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No sends found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'sendId', header: 'SEND' },
    { key: 'kind', header: 'KIND' },
    { key: 'status', header: 'STATUS' },
    { key: 'subject', header: 'SUBJECT' },
  ])
}
