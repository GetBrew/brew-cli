import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { renderTable } from '../../lib/output'
import { rawRequest } from '../../lib/raw-request'

type IntegrationsListResponse =
  components['schemas']['IntegrationsListResponse']

export const integrationsListCommand = defineCommand({
  path: ['integrations', 'list'],
  summary:
    'List the integration catalog with per-provider connected state (connect via Settings, not this CLI)',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/integrations' },
  commandClass: 'read',
  examples: ['brew-cli integrations list', 'brew-cli integrations list --json'],
  run: async ({ ctx }) => {
    const result = await rawRequest<IntegrationsListResponse>(ctx, {
      method: 'GET',
      path: '/v1/integrations',
    })
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
