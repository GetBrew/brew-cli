import type { ListEmailsInput } from '@brew.new/sdk'
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

export const emailsListCommand = defineCommand({
  path: ['emails', 'list'],
  summary: 'List email designs; one design is `emails get`',
  sdkMethod: 'emails.list',
  route: { method: 'GET', path: '/v1/emails' },
  commandClass: 'read',
  flags: [
    {
      flag: '--status <status>',
      summary: 'Filter by status: generating | ready | failed',
    },
    {
      flag: '--group-id <groupId>',
      summary: 'Filter by one group id; use ungrouped for no saved group',
    },
    {
      flag: '--sort-by <field>',
      summary:
        'Timestamp the page is ordered by and that --since/--until bound: updatedAt (default) | createdAt',
    },
    {
      flag: '--since <iso>',
      summary: 'Inclusive lower bound on the --sort-by timestamp (ISO-8601)',
    },
    {
      flag: '--until <iso>',
      summary: 'Inclusive upper bound on the --sort-by timestamp (ISO-8601)',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli emails list --status ready --limit 10',
    'brew-cli emails list --group-id ungrouped',
    'brew-cli emails list --sort-by createdAt --since 2026-08-01T00:00:00Z',
    'brew-cli emails list --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      status: flagString(flags.status),
      groupId: flagString(flags.groupId),
      sortBy: flagString(flags.sortBy),
      from: flagString(flags.since),
      to: flagString(flags.until),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const emails = ctx.client().emails
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        emails.list(
          asSdkInput<ListEmailsInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderEmails(rows),
      }
    }
    const result = await emails.list(asSdkInput<ListEmailsInput>(input))
    return { data: result, human: renderEmails(result.data) }
  },
})

function renderEmails(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No email designs found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'emailId', header: 'EMAIL ID' },
    { key: 'title', header: 'TITLE' },
    { key: 'status', header: 'STATUS' },
    { key: 'groupName', header: 'GROUP' },
    { key: 'updatedAt', header: 'UPDATED' },
  ])
}
