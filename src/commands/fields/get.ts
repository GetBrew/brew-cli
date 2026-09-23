import { defineCommand } from '../../lib/define-command'

export const fieldsGetCommand = defineCommand({
  path: ['fields', 'get'],
  summary: 'Fetch one contact field definition by name — the bare row',
  sdkMethod: 'fields.get',
  route: { method: 'GET', path: '/v1/fields/{fieldName}' },
  commandClass: 'read',
  args: [
    {
      name: 'fieldName',
      summary: 'Field name (a core column or a custom field)',
      isRequired: true,
    },
  ],
  examples: ['brew-cli fields get loyalty_tier'],
  run: async ({ ctx, args }) => ({
    data: await ctx.client().fields.get(args.fieldName ?? ''),
  }),
})
