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

type IntegrationsPage =
  operations['listIntegrations']['responses'][200]['content']['application/json']

export const integrationsListCommand = defineCommand({
  path: ['integrations', 'list'],
  summary:
    'List the integration catalog with per-provider connected state (connect via Settings, not this CLI)',
  sdkMethod: 'integrations.list',
  route: { method: 'GET', path: '/v1/integrations' },
  commandClass: 'read',
  flags: [LIMIT_FLAG, CURSOR_FLAG, ALL_FLAG],
  examples: ['brew-cli integrations list', 'brew-cli integrations list --json'],
  run: async ({ ctx, flags }) => {
    const limit = flagInt(flags.limit, '--limit')
    const cursor = flagString(flags.cursor)
    if (limit === undefined && cursor === undefined && flags.all !== true) {
      const result = await ctx.client().integrations.list()
      return { data: result, human: renderIntegrations(result.data) }
    }
    // `@brew.new/sdk` 10's `integrations.list(options?)` takes no page input, so a
    // paged read goes through the raw transport.
    const page = (after: string | undefined) =>
      rawRequest<IntegrationsPage>(ctx, {
        method: 'GET',
        path: '/v1/integrations',
        query: {
          limit: limit === undefined ? undefined : String(limit),
          cursor: after,
        },
      })
    if (flags.all === true) {
      const rows = await collectAll(ctx, (next) => page(next ?? cursor))
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderIntegrations(rows),
      }
    }
    const result = await page(cursor)
    return { data: result, human: renderIntegrations(result.data) }
  },
})

function renderIntegrations(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No integrations found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'provider', header: 'PROVIDER' },
    { key: 'name', header: 'NAME' },
    { key: 'category', header: 'CATEGORY' },
    { key: 'connected', header: 'CONNECTED' },
  ])
}
