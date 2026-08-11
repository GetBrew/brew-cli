import type { UpsertContactInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  parseKeyValues,
  readJsonFlag,
  requestOptions,
} from '../../lib/input'

export const contactsUpsertCommand = defineCommand({
  path: ['contacts', 'upsert'],
  summary: 'Create or update one contact by email',
  sdkMethod: 'contacts.upsert',
  route: { method: 'POST', path: '/v1/contacts' },
  commandClass: 'write',
  flags: [
    { flag: '--email <email>', summary: 'Email address (the identity)' },
    { flag: '--first-name <name>', summary: 'First name' },
    { flag: '--last-name <name>', summary: 'Last name' },
    {
      flag: '--subscribed <bool>',
      summary: 'Subscription state: true | false',
    },
    {
      flag: '--custom <pairs...>',
      summary: 'Custom field key=value, repeatable',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli contacts upsert --email jane@example.com --first-name Jane',
    'brew-cli contacts upsert --email j@x.com --custom plan=pro --custom seats=4',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      email: flagString(flags.email),
      firstName: flagString(flags.firstName),
      lastName: flagString(flags.lastName),
      subscribed: parseBool(flags.subscribed),
      customFields: parseKeyValues(flags.custom, '--custom'),
    })
    if (typeof input.email !== 'string' || input.email === '') {
      throw new CliUsageError('An email is required (--email or --input).')
    }
    const result = await ctx
      .client()
      .contacts.upsert(
        asSdkInput<UpsertContactInput>(input),
        requestOptions(flags)
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
