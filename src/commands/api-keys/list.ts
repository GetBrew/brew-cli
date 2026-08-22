import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { renderTable } from '../../lib/output'
import { rawRequest } from '../../lib/raw-request'

type ApiKeysListResponse = components['schemas']['ApiKeysListResponse']

export const apiKeysListCommand = defineCommand({
  path: ['api-keys', 'list'],
  summary:
    'List API keys in the organization (already-redacted `keyPreview`, never the secret)',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/api-keys' },
  commandClass: 'read',
  examples: ['brew-cli api-keys list', 'brew-cli api-keys list --json'],
  run: async ({ ctx }) => {
    const result = await rawRequest<ApiKeysListResponse>(ctx, {
      method: 'GET',
      path: '/v1/api-keys',
    })
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
