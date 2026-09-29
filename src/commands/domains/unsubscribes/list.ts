import type { ListDomainUnsubscribesInput } from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import { asSdkInput, flagInt, flagString } from '../../../lib/input'
import { renderTable } from '../../../lib/output'
import { CURSOR_FLAG, LIMIT_FLAG } from '../../../lib/paginate'

/** One page of a marketing domain's unsubscribe list. */
export const domainsUnsubscribesListCommand = defineCommand({
  path: ['domains', 'unsubscribes', 'list'],
  summary: "One page of a marketing domain's unsubscribe list, newest first",
  sdkMethod: 'domains.unsubscribes.list',
  route: { method: 'GET', path: '/v1/domains/{domainId}/unsubscribes' },
  commandClass: 'read',
  args: [
    { name: 'domainId', summary: 'Marketing domain id', isRequired: true },
  ],
  flags: [
    { flag: '--q <text>', summary: 'Search by address' },
    {
      flag: '--scope <scope>',
      summary:
        'any (default), domain (this list only) or all (brand-wide opt-outs)',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
  ],
  examples: [
    'brew-cli domains unsubscribes list dom_123',
    'brew-cli domains unsubscribes list dom_123 --scope domain --q ada',
  ],
  run: async ({ ctx, args, flags }) => {
    const limit = flagInt(flags.limit, '--limit')
    const q = flagString(flags.q)
    const scope = flagString(flags.scope)
    const cursor = flagString(flags.cursor)
    // --scope passes through unchecked: the API validates it.
    const body = await ctx.client().domains.unsubscribes.list(
      asSdkInput<ListDomainUnsubscribesInput>({
        domainId: args.domainId ?? '',
        ...(q === undefined ? {} : { q }),
        ...(scope === undefined ? {} : { scope }),
        ...(limit === undefined ? {} : { limit }),
        ...(cursor === undefined ? {} : { cursor }),
      })
    )
    return { data: body, human: renderRows(body.data) }
  },
})

function renderRows(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No unsubscribes on this list.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'email', header: 'EMAIL' },
    { key: 'scope', header: 'SCOPE' },
    { key: 'unsubscribedAt', header: 'UNSUBSCRIBED' },
  ])
}
