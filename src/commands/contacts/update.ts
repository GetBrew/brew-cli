import type { PatchContactInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  INPUT_FLAG,
  mergeInput,
  parseKeyValues,
  readJsonFlag,
} from '../../lib/input'

export const contactsUpdateCommand = defineCommand({
  path: ['contacts', 'update'],
  summary: 'Partially update one contact (PATCH; never retried)',
  sdkMethod: 'contacts.patch',
  route: { method: 'PATCH', path: '/v1/contacts/{email}' },
  commandClass: 'write',
  args: [
    {
      name: 'email',
      summary: 'Email address of the contact',
      isRequired: true,
    },
  ],
  flags: [
    { flag: '--first-name <name>', summary: 'First name' },
    { flag: '--last-name <name>', summary: 'Last name' },
    {
      flag: '--subscribed <bool>',
      summary: 'Subscription state: true | false',
    },
    { flag: '--set <pairs...>', summary: 'Field key=value, repeatable' },
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli contacts update jane@example.com --first-name Jane',
    'brew-cli contacts update j@x.com --set plan=enterprise',
  ],
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const fields = mergeInput(base, {
      firstName: flagString(flags.firstName),
      lastName: flagString(flags.lastName),
      subscribed: parseBool(flags.subscribed),
      ...(parseKeyValues(flags.set, '--set') ?? {}),
    })
    if (Object.keys(fields).length === 0) {
      throw new CliUsageError('Nothing to update — pass flags or --input.')
    }
    const result = await ctx.client().contacts.patch(
      asSdkInput<PatchContactInput>({
        email: args.email ?? '',
        fields,
      })
    )
    return { data: result }
  },
})

function parseBool(value: unknown): boolean | undefined {
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  if (value === undefined) {
    return
  }
  throw new CliUsageError('--subscribed must be true or false')
}
