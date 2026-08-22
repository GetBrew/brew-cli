import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { rawRequest } from '../../lib/raw-request'

type ApiKeysDeleteResponse = components['schemas']['ApiKeysDeleteResponse']

export const apiKeysDeleteCommand = defineCommand({
  path: ['api-keys', 'delete'],
  summary: 'Revoke an API key',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'DELETE', path: '/v1/api-keys/{keyId}' },
  commandClass: 'destructive',
  args: [{ name: 'keyId', summary: 'API key id to revoke', isRequired: true }],
  examples: ['brew-cli api-keys delete kd7b3s7fapqz8mjm12ekz1kxdx87yceg --yes'],
  confirmSummary: ({ args }) =>
    `Revoke API key ${args.keyId ?? ''}. Anything still using it starts failing immediately. This cannot be undone.`,
  run: async ({ ctx, args }) => ({
    data: await rawRequest<ApiKeysDeleteResponse>(ctx, {
      method: 'DELETE',
      path: `/v1/api-keys/${encodeURIComponent(args.keyId ?? '')}`,
    }),
  }),
})
