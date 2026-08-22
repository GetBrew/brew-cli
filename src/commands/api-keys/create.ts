import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import {
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  toStringArray,
} from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type ApiKeysCreateResponse = components['schemas']['ApiKeysCreateResponse']

export const apiKeysCreateCommand = defineCommand({
  path: ['api-keys', 'create'],
  summary:
    'Mint an API key; the plaintext `key` is returned ONCE — this output is the only copy',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/api-keys' },
  commandClass: 'write',
  flags: [
    { flag: '--name <name>', summary: 'Label for the key' },
    {
      flag: '--permissions <scopes...>',
      summary:
        'all | contacts | emails | automations | transactional | domains | sends | audiences | brands (default: all)',
    },
    {
      flag: '--brand-id <brandId>',
      summary:
        'Bind the NEW key to this brand id (omit for an organization-wide key); not the acting --brand',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli api-keys create --name CI --permissions emails domains',
    'brew-cli api-keys create --name "Acme key" --brand-id kx7b3s7fapqz8mjm12ekz1kxdx87yceg',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      name: flagString(flags.name),
      permissions: toStringArray(flags.permissions),
      brandId: flagString(flags.brandId),
    })
    // The plaintext `key` is never shown again after this call — pass the
    // API response through verbatim (no masking) or the command loses its
    // only purpose.
    return {
      data: await rawRequest<ApiKeysCreateResponse>(ctx, {
        method: 'POST',
        path: '/v1/api-keys',
        body: input,
        idempotencyKey: flagString(flags.idempotencyKey),
      }),
    }
  },
})
