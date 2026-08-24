import { defineCommand } from '../../lib/define-command'

export const brandsGetCommand = defineCommand({
  path: ['brands', 'get'],
  summary: "One brand's lifecycle state (the extraction polling endpoint)",
  sdkMethod: 'brands.get',
  route: { method: 'GET', path: '/v1/brands/{brandId}' },
  commandClass: 'read',
  args: [{ name: 'brandId', summary: 'Brand id to fetch', isRequired: true }],
  examples: ['brew-cli brands get kx7b3s7fapqz8mjm12ekz1kxdx87yceg'],
  run: async ({ ctx, args }) => ({
    data: await ctx.client().brands.get({ brandId: args.brandId ?? '' }),
  }),
})
