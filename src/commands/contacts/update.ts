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
    {
      ...INPUT_FLAG,
      summary:
        'JSON body {fields, consent} or flat fields; precedence: flat < nested fields < flags (- reads stdin)',
    },
  ],
  examples: [
    'brew-cli contacts update jane@example.com --first-name Jane',
    'brew-cli contacts update j@x.com --set plan=enterprise',
    'brew-cli contacts update j@x.com --input \'{"fields":{"firstName":"Jane"}}\' --first-name Janet',
    'brew-cli contacts update j@x.com --input \'{"consent":{"source":"api","evidence":"Signup form"}}\'',
    'brew-cli contacts update j@x.com --input \'{"firstName":"Jane"}\'',
  ],
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    if (base !== undefined && !isRecord(base)) {
      throw new CliUsageError('--input must be a JSON object')
    }
    const { fields: nestedFields, consent, ...flatFields } = base ?? {}
    if (nestedFields !== undefined && !isRecord(nestedFields)) {
      throw new CliUsageError('--input.fields must be a JSON object')
    }
    const fields = mergeInput(
      { ...flatFields, ...nestedFields },
      {
        firstName: flagString(flags.firstName),
        lastName: flagString(flags.lastName),
        subscribed: parseBool(flags.subscribed),
        ...(parseKeyValues(flags.set, '--set') ?? {}),
      }
    )
    const hasFields = Object.keys(fields).length > 0
    if (!hasFields && consent === undefined) {
      throw new CliUsageError('Nothing to update — pass flags or --input.')
    }
    const result = await ctx.client().contacts.patch(
      asSdkInput<PatchContactInput>({
        email: args.email ?? '',
        ...(hasFields ? { fields } : {}),
        ...(consent === undefined ? {} : { consent }),
      })
    )
    return { data: result }
  },
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

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
