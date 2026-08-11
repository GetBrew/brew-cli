import type { ContactsResource } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  readJsonFlag,
  requestOptions,
  toStringArray,
} from '../../lib/input'

type ValidateContactsInput = Parameters<ContactsResource['validate']>[0]

export const contactsValidateCommand = defineCommand({
  path: ['contacts', 'validate'],
  summary: 'Batch-validate email deliverability (no contacts created)',
  sdkMethod: 'contacts.validate',
  route: { method: 'POST', path: '/v1/contacts/validate' },
  commandClass: 'write',
  isCredited: true,
  flags: [
    {
      flag: '--emails <emails...>',
      summary: 'Email address(es) to validate, repeatable',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli contacts validate --emails jane@example.com bob@example.com',
    `brew-cli contacts validate --input '{"emails":["jane@example.com"]}'`,
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const fromFlags = toStringArray(flags.emails)
    const input =
      fromFlags === undefined
        ? Array.isArray(base)
          ? { emails: base }
          : base
        : { emails: fromFlags }
    if (input === undefined) {
      throw new CliUsageError('Pass --emails or --input.')
    }
    const result = await ctx
      .client()
      .contacts.validate(
        asSdkInput<ValidateContactsInput>(input),
        requestOptions(flags)
      )
    return { data: result }
  },
})
