import type { UpsertManyContactsInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  readJsonFlag,
  requestOptions,
} from '../../lib/input'

export const contactsUpsertManyCommand = defineCommand({
  path: ['contacts', 'upsert-many'],
  summary: 'Create or update a batch of contacts (up to 100 per call)',
  sdkMethod: 'contacts.upsertMany',
  route: { method: 'POST', path: '/v1/contacts' },
  commandClass: 'write',
  flags: [INPUT_FLAG, IDEMPOTENCY_FLAG],
  examples: [
    `brew-cli contacts upsert-many --input '{"contacts":[{"email":"a@x.com"}]}'`,
    'cat contacts.json | brew-cli contacts upsert-many --input -',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    if (base === undefined) {
      throw new CliUsageError('--input is required (JSON or - for stdin).')
    }
    const input = Array.isArray(base) ? { contacts: base } : base
    const result = await ctx
      .client()
      .contacts.upsertMany(
        asSdkInput<UpsertManyContactsInput>(input),
        requestOptions(flags)
      )
    return { data: result }
  },
})
