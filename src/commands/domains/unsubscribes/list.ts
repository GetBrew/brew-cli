import type { operations } from '../../../generated/openapi-types'
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

type DomainUnsubscribesPage =
  operations['listDomainUnsubscribes']['responses'][200]['content']['application/json']

/** `?scope=` on the list and export reads. */
export const UNSUBSCRIBE_SCOPE_FLAG = {
  flag: '--scope <scope>',
  summary:
    "domain (this domain's list), all (the brand-wide opt-out) or any (default: either)",
} as const

/**
 * A marketing sending domain's own unsubscribe list. Raw route because
 * `@brew.new/sdk` 10 has no method for it: once the CLI adopts the SDK
 * release that ships the domain-unsubscribe methods, bind the list method
 * here and drop `isRawTransport` (likewise for the other
 * `domains unsubscribes` commands).
 */
export const domainsUnsubscribesListCommand = defineCommand({
  path: ['domains', 'unsubscribes', 'list'],
  summary:
    "List a marketing domain's unsubscribes, newest first; each row's scope says domain, all (brand-wide) or both",
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/domains/{domainId}/unsubscribes' },
  commandClass: 'read',
  args: [
    {
      name: 'domainId',
      summary: 'Marketing domain id (from `domains list`)',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--query <text>',
      summary:
        'Search: an address (anything with @) matches it, by prefix while partial; other text searches address and name',
    },
    UNSUBSCRIBE_SCOPE_FLAG,
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli domains unsubscribes list kx7bkh53hasmfeh5kd7sqgykt187g8ww',
    'brew-cli domains unsubscribes list kx7bkh53hasmfeh5kd7sqgykt187g8ww --scope domain --query jane@',
  ],
  // A transactional domain owns no list: the API answers
  // 422 DOMAIN_PURPOSE_NOT_ALLOWED.
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      q: flagString(flags.query),
      scope: flagString(flags.scope),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const fetchPage = (cursor: string | undefined) =>
      rawRequest<DomainUnsubscribesPage>(ctx, {
        method: 'GET',
        path: `/v1/domains/${encodeURIComponent(args.domainId ?? '')}/unsubscribes`,
        query: {
          q: flagString(input.q),
          scope: flagString(input.scope),
          limit: input.limit === undefined ? undefined : String(input.limit),
          cursor: cursor ?? flagString(input.cursor),
        },
      })
    if (flags.all === true) {
      const pages: DomainUnsubscribesPage[] = []
      const rows = await collectAll(ctx, async (cursor) => {
        const page = await fetchPage(cursor)
        pages.push(page)
        return page
      })
      return {
        data: {
          domainId: pages[0]?.domainId,
          domainHost: pages[0]?.domainHost,
          data: rows,
          pagination: { cursor: null, hasMore: false },
        },
        human: renderUnsubscribes(rows),
      }
    }
    const page = await fetchPage(undefined)
    return { data: page, human: renderUnsubscribes(page.data) }
  },
})

function renderUnsubscribes(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No unsubscribes found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'email', header: 'EMAIL' },
    { key: 'scope', header: 'SCOPE' },
    { key: 'unsubscribedAt', header: 'UNSUBSCRIBED AT' },
    { key: 'source', header: 'SOURCE' },
    { key: 'sendId', header: 'SEND ID' },
  ])
}
