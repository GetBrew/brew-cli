import { defineCommand } from '../../lib/define-command'

export const brandsListCommand = defineCommand({
  path: ['brands', 'list'],
  summary: 'List every brand in the organization',
  sdkMethod: 'brands.list',
  route: { method: 'GET', path: '/v1/brands' },
  commandClass: 'read',
  examples: ['brew-cli brands list --json'],
  run: async ({ ctx }) => ({
    data: await ctx.client().brands.list(),
  }),
})
