import type { ListEmailsInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
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
    { flag: '--sort <field>', summary: '0.6 alias of --sort-by' },
    {
      flag: '--order <order>',
      summary: '0.6 flag: pages are newest first; only desc is accepted',
    },
    {
      flag: '--created-at-from <iso>',
      summary: '0.6 alias of --sort-by createdAt --since <iso>',
    },
    {
      flag: '--created-at-to <iso>',
      summary: '0.6 alias of --sort-by createdAt --until <iso>',
    },
    {
      flag: '--updated-at-from <iso>',
      summary: '0.6 alias of --sort-by updatedAt --since <iso>',
    },
    {
      flag: '--updated-at-to <iso>',
      summary: '0.6 alias of --sort-by updatedAt --until <iso>',
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
    const legacy = legacyWindow(flags)
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      status: flagString(flags.status),
      groupId: flagString(flags.groupId),
      sortBy:
        flagString(flags.sortBy) ?? flagString(flags.sort) ?? legacy.sortBy,
      from: flagString(flags.since) ?? legacy.from,
      to: flagString(flags.until) ?? legacy.to,
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

/**
 * 0.6 took a window per column (`--created-at-from`, `--updated-at-to`, …)
 * plus `--sort`/`--order`; the API now orders by ONE `sortBy` timestamp that
 * `from`/`to` bound, newest first. Fold the released flags onto that.
 */
function legacyWindow(flags: Readonly<Record<string, unknown>>): {
  readonly sortBy: string | undefined
  readonly from: string | undefined
  readonly to: string | undefined
} {
  const order = flagString(flags.order)
  if (order !== undefined && order !== 'desc') {
    throw new CliUsageError(
      'GET /v1/emails pages newest first only; --order asc has no equivalent.'
    )
  }
  const created = {
    from: flagString(flags.createdAtFrom),
    to: flagString(flags.createdAtTo),
  }
  const updated = {
    from: flagString(flags.updatedAtFrom),
    to: flagString(flags.updatedAtTo),
  }
  const hasCreated = created.from !== undefined || created.to !== undefined
  const hasUpdated = updated.from !== undefined || updated.to !== undefined
  if (hasCreated && hasUpdated) {
    throw new CliUsageError(
      'The API bounds one timestamp per page: pass --created-at-* or --updated-at-*, not both (or --sort-by with --since/--until).'
    )
  }
  if (hasCreated) {
    return { sortBy: 'createdAt', ...created }
  }
  if (hasUpdated) {
    return { sortBy: 'updatedAt', ...updated }
  }
  return { sortBy: undefined, from: undefined, to: undefined }
}

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
