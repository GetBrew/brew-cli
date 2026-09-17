import { defineCommand } from '../../lib/define-command'

export const contactsGetCommand = defineCommand({
  path: ['contacts', 'get'],
  summary: 'Fetch one contact by email — the bare row',
  sdkMethod: 'contacts.get',
  route: { method: 'GET', path: '/v1/contacts/{email}' },
  commandClass: 'read',
  args: [
    {
      name: 'email',
      summary: 'Email address of the contact (the contact primary key)',
      isRequired: true,
    },
  ],
  examples: ['brew-cli contacts get jane@example.com'],
  run: async ({ ctx, args }) => ({
    data: await ctx.client().contacts.get(args.email ?? ''),
  }),
})
