import { defineCommand } from '../../lib/define-command'
import { CliApiError } from '../../lib/errors'

export const contactsGetCommand = defineCommand({
  path: ['contacts', 'get'],
  summary: 'Fetch one contact by email',
  sdkMethod: null,
  derivedFrom: 'contacts.search',
  route: { method: 'POST', path: '/v1/contacts/search' },
  commandClass: 'read',
  args: [
    {
      name: 'email',
      summary: 'Email address of the contact',
      isRequired: true,
    },
  ],
  examples: ['brew-cli contacts get jane@example.com'],
  run: async ({ ctx, args }) => {
    const email = args.email ?? ''
    const result = await ctx.client().contacts.search({
      filters: [{ field: 'email', operator: 'equals', value: email }],
      limit: 1,
    })
    const contact = result.data[0]
    if (contact === undefined) {
      throw new CliApiError({
        status: 404,
        code: 'CONTACT_NOT_FOUND',
        type: 'not_found',
        message: `No contact found for ${email}`,
        suggestion:
          'Check the address, or create the contact with `brew-cli contacts upsert`.',
      })
    }
    return { data: contact }
  },
})
