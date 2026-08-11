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
  summary: 'List email designs (the single email read)',
  sdkMethod: 'emails.list',
  route: { method: 'GET', path: '/v1/emails' },
  commandClass: 'read',
  flags: [
    {
      flag: '--status <status>',
      summary: 'Filter by status: streaming | complete | error',
    },
    { flag: '--created-at-from <iso>', summary: 'Created at or after (ISO)' },
    { flag: '--created-at-to <iso>', summary: 'Created at or before (ISO)' },
    { flag: '--updated-at-from <iso>', summary: 'Updated at or after (ISO)' },
    { flag: '--updated-at-to <iso>', summary: 'Updated at or before (ISO)' },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli emails list --status complete --limit 10',
    'brew-cli emails list --updated-at-from 2026-08-01T00:00:00Z',
    'brew-cli emails list --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      status: flagString(flags.status),
      createdAtFrom: flagString(flags.createdAtFrom),
      createdAtTo: flagString(flags.createdAtTo),
      updatedAtFrom: flagString(flags.updatedAtFrom),
      updatedAtTo: flagString(flags.updatedAtTo),
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
    { key: 'updatedAt', header: 'UPDATED' },
  ])
}
