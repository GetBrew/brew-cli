import { defineCommand } from '../../lib/define-command'
import { renderTable } from '../../lib/output'

export const integrationsListCommand = defineCommand({
  path: ['integrations', 'list'],
  summary:
    'List the integration catalog with per-provider connected state (connect via Settings, not this CLI)',
  sdkMethod: 'integrations.list',
  route: { method: 'GET', path: '/v1/integrations' },
  commandClass: 'read',
  examples: ['brew-cli integrations list', 'brew-cli integrations list --json'],
  run: async ({ ctx }) => {
    const result = await ctx.client().integrations.list()
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
