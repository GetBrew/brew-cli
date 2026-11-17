import { defineCommand } from '../../lib/define-command'
import { flagString } from '../../lib/input'

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
  flags: [
    {
      flag: '--include <tokens>',
      summary:
        "Expansions: openProfile (the contact's smart-send open-time profile, null before any opens; needs the emails scope too)",
    },
  ],
  examples: [
    'brew-cli contacts get jane@example.com',
    'brew-cli contacts get jane@example.com --include openProfile --json',
  ],
  run: async ({ ctx, args, flags }) => {
    const include = flagString(flags.include)
    return {
      data: await ctx
        .client()
        .contacts.get(
          args.email ?? '',
          include === undefined ? undefined : { include }
        ),
    }
  },
})
