import { defineCommand } from '../../lib/define-command'

export const fieldsDeleteCommand = defineCommand({
  path: ['fields', 'delete'],
  summary: 'Delete a custom field definition',
  sdkMethod: 'fields.delete',
  route: { method: 'DELETE', path: '/v1/fields/{fieldName}' },
  commandClass: 'destructive',
  args: [
    {
      name: 'fieldName',
      summary: 'Name of the field to delete',
      isRequired: true,
    },
  ],
  examples: ['brew-cli fields delete plan --yes'],
  confirmSummary: ({ args }) =>
    `Delete the custom field definition "${args.fieldName ?? ''}". This cannot be undone.`,
  run: async ({ ctx, args }) => ({
    data: await ctx.client().fields.delete({ fieldName: args.fieldName ?? '' }),
  }),
})
