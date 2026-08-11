import { defineCommand } from '../../lib/define-command'

export const emailsDeleteCommand = defineCommand({
  path: ['emails', 'delete'],
  summary: 'Hard-delete an email design and all its versions (idempotent)',
  sdkMethod: 'emails.delete',
  route: { method: 'DELETE', path: '/v1/emails/{emailId}' },
  commandClass: 'destructive',
  args: [{ name: 'emailId', summary: 'Design id to delete', isRequired: true }],
  examples: ['brew-cli emails delete eml_2SmZOWV3ZQ7W5x6g3m4p --yes'],
  confirmSummary: ({ args }) =>
    `Hard-delete email design ${args.emailId ?? ''} and ALL its versions. This cannot be undone.`,
  run: async ({ ctx, args }) => ({
    data: await ctx.client().emails.delete({ emailId: args.emailId ?? '' }),
  }),
})
