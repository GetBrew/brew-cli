import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { rawRequest } from '../../lib/raw-request'

type BrandGetByIdResponse = components['schemas']['BrandGetByIdResponse']

export const brandsGetCommand = defineCommand({
  path: ['brands', 'get'],
  summary: "One brand's lifecycle state (the extraction polling endpoint)",
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/brands/{brandId}' },
  commandClass: 'read',
  args: [{ name: 'brandId', summary: 'Brand id to fetch', isRequired: true }],
  examples: ['brew-cli brands get kx7b3s7fapqz8mjm12ekz1kxdx87yceg'],
  run: async ({ ctx, args }) => ({
    data: await rawRequest<BrandGetByIdResponse>(ctx, {
      method: 'GET',
      path: `/v1/brands/${encodeURIComponent(args.brandId ?? '')}`,
    }),
  }),
})
