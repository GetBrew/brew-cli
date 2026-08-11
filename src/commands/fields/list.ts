import { defineCommand } from '../../lib/define-command'

export const fieldsListCommand = defineCommand({
  path: ['fields', 'list'],
  summary: 'List custom contact fields',
  sdkMethod: 'fields.list',
  route: { method: 'GET', path: '/v1/fields' },
  commandClass: 'read',
  examples: ['brew-cli fields list'],
  run: async ({ ctx }) => ({ data: await ctx.client().fields.list() }),
})
