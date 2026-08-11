import type { ListDomainsInput } from '@brew.new/sdk'
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

export const domainsListCommand = defineCommand({
  path: ['domains', 'list'],
  summary: 'List sending domains with verification state and DNS records',
  sdkMethod: 'domains.list',
  route: { method: 'GET', path: '/v1/domains' },
  commandClass: 'read',
  flags: [
    {
      flag: '--sendable-only',
      summary: 'Only domains currently able to send',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli domains list',
    'brew-cli domains list --sendable-only --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      sendableOnly: flags.sendableOnly === true ? true : undefined,
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const domains = ctx.client().domains
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        domains.list(
          asSdkInput<ListDomainsInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderDomains(rows),
      }
    }
    const result = await domains.list(asSdkInput<ListDomainsInput>(input))
    return { data: result, human: renderDomains(result.data) }
  },
})

function renderDomains(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No sending domains found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'domainId', header: 'DOMAIN ID' },
    { key: 'name', header: 'NAME' },
    { key: 'status', header: 'STATUS' },
    { key: 'sendable', header: 'SENDABLE' },
  ])
}
