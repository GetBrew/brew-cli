import { defineCommand } from '../../lib/define-command'

export const contactsDeleteCommand = defineCommand({
  path: ['contacts', 'delete'],
  summary: 'Delete one contact by email (idempotent)',
  sdkMethod: 'contacts.delete',
  route: { method: 'DELETE', path: '/v1/contacts/{email}' },
  commandClass: 'destructive',
  args: [
    {
      name: 'email',
      summary: 'Email address of the contact to delete',
      isRequired: true,
    },
  ],
  examples: ['brew-cli contacts delete jane@example.com --yes'],
  confirmSummary: ({ args }) =>
    `Delete contact ${args.email ?? ''} from the active brand. This cannot be undone.`,
  run: async ({ ctx, args }) => ({
    data: await ctx.client().contacts.delete({ email: args.email ?? '' }),
  }),
})
