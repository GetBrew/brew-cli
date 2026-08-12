import type { components } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import {
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
import { rawRequest } from '../../../lib/raw-request'

type EmailGroupsListResponse = components['schemas']['EmailGroupsListResponse']

export const emailsGroupsListCommand = defineCommand({
  path: ['emails', 'groups', 'list'],
  summary: 'List email groups in display order, including Ungrouped',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/email-groups' },
  commandClass: 'read',
  flags: [LIMIT_FLAG, CURSOR_FLAG, ALL_FLAG, INPUT_FLAG],
  examples: [
    'brew-cli emails groups list',
    'brew-cli emails groups list --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const fetchPage = (cursor: string | undefined) =>
      rawRequest<EmailGroupsListResponse>(ctx, {
        method: 'GET',
        path: '/v1/email-groups',
        query: {
          limit:
            typeof input.limit === 'number' ? String(input.limit) : undefined,
          cursor:
            cursor ??
            (typeof input.cursor === 'string' ? input.cursor : undefined),
        },
      })
    if (flags.all === true) {
      const rows = await collectAll(ctx, fetchPage)
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderEmailGroups(rows),
      }
    }
    const result = await fetchPage(undefined)
    return { data: result, human: renderEmailGroups(result.data) }
  },
})

function renderEmailGroups(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No email groups found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'groupId', header: 'GROUP ID' },
    { key: 'groupName', header: 'GROUP' },
  ])
}
