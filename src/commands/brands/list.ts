import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { rawRequest } from '../../lib/raw-request'

type BrandsListResponse = components['schemas']['BrandsListResponse']

export const brandsListCommand = defineCommand({
  path: ['brands', 'list'],
  summary: 'List every brand in the organization',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/brands' },
  commandClass: 'read',
  examples: ['brew-cli brands list --json'],
  run: async ({ ctx }) => ({
    data: await rawRequest<BrandsListResponse>(ctx, {
      method: 'GET',
      path: '/v1/brands',
    }),
  }),
})
