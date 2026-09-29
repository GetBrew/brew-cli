import type { operations } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { flagInt, flagString } from '../../../lib/input'
import { renderTable } from '../../../lib/output'
import { CURSOR_FLAG, LIMIT_FLAG } from '../../../lib/paginate'
import { rawRequest } from '../../../lib/raw-request'

type Page =
  operations['listDomainUnsubscribes']['responses'][200]['content']['application/json']

/**
 * One page of a marketing domain's unsubscribe list. Raw route because
 * `@brew.new/sdk` 10 has no method for it: once the CLI adopts SDK 11.2,
 * bind `domains.unsubscribes.list(...)` here and drop `isRawTransport`.
 */
export const domainsUnsubscribesListCommand = defineCommand({
  path: ['domains', 'unsubscribes', 'list'],
  summary: "One page of a marketing domain's unsubscribe list, newest first",
  sdkMethod: null,
  isRawTransport: true,
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
    const body = await rawRequest<Page>(ctx, {
      method: 'GET',
      path: `/v1/domains/${encodeURIComponent(args.domainId ?? '')}/unsubscribes`,
      query: {
        q: flagString(flags.q),
        scope: flagString(flags.scope),
        limit: limit === undefined ? undefined : String(limit),
        cursor: flagString(flags.cursor),
      },
    })
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
