import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { flagInt, flagString } from '../../lib/input'
import { renderTable } from '../../lib/output'
import {
  ALL_FLAG,
  CURSOR_FLAG,
  collectAll,
  LIMIT_FLAG,
} from '../../lib/paginate'
import { rawRequest } from '../../lib/raw-request'

type ApiKeysPage =
  operations['listApiKeys']['responses'][200]['content']['application/json']

export const apiKeysListCommand = defineCommand({
  path: ['api-keys', 'list'],
  summary:
    'List API keys in the organization (already-redacted `keyPreview`, never the secret)',
  sdkMethod: 'apiKeys.list',
  route: { method: 'GET', path: '/v1/api-keys' },
  commandClass: 'read',
  flags: [LIMIT_FLAG, CURSOR_FLAG, ALL_FLAG],
  examples: ['brew-cli api-keys list', 'brew-cli api-keys list --json'],
  run: async ({ ctx, flags }) => {
    const limit = flagInt(flags.limit, '--limit')
    const cursor = flagString(flags.cursor)
    if (limit === undefined && cursor === undefined && flags.all !== true) {
      const result = await ctx.client().apiKeys.list()
      return { data: result, human: renderApiKeys(result.data) }
    }
    // `@brew.new/sdk` 10's `apiKeys.list(options?)` takes no page input, so a
    // paged read goes through the raw transport.
    const page = (after: string | undefined) =>
      rawRequest<ApiKeysPage>(ctx, {
        method: 'GET',
        path: '/v1/api-keys',
        query: {
          limit: limit === undefined ? undefined : String(limit),
          cursor: after,
        },
      })
    if (flags.all === true) {
      const rows = await collectAll(ctx, (next) => page(next ?? cursor))
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderApiKeys(rows),
      }
    }
    const result = await page(cursor)
    return { data: result, human: renderApiKeys(result.data) }
  },
})

function renderApiKeys(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No API keys found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'keyId', header: 'KEY ID' },
    { key: 'name', header: 'NAME' },
    { key: 'keyPreview', header: 'KEY PREVIEW' },
    { key: 'status', header: 'STATUS' },
    { key: 'brandId', header: 'BRAND ID' },
  ])
}
