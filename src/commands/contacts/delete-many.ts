import type { DeleteManyContactsInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  readJsonFlag,
  requestOptions,
} from '../../lib/input'

export const contactsDeleteManyCommand = defineCommand({
  path: ['contacts', 'delete-many'],
  summary: 'Delete up to 1000 contacts by email',
  sdkMethod: 'contacts.deleteMany',
  route: { method: 'POST', path: '/v1/contacts/batch-delete' },
  commandClass: 'destructive',
  flags: [INPUT_FLAG, IDEMPOTENCY_FLAG],
  examples: [
    `brew-cli contacts delete-many --input '{"emails":["a@x.com","b@x.com"]}' --yes`,
    'cat emails.json | brew-cli contacts delete-many --input - --yes',
  ],
  confirmSummary: ({ flags }) => {
    const count = inlineEmailCount(flags.input)
    return count === undefined
      ? 'Delete the contacts listed in --input. This cannot be undone.'
      : `Delete ${count} contact(s). This cannot be undone.`
  },
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    if (base === undefined) {
      throw new CliUsageError('--input is required (JSON or - for stdin).')
    }
    const input = Array.isArray(base) ? { emails: base } : base
    const result = await ctx
      .client()
      .contacts.deleteMany(
        asSdkInput<DeleteManyContactsInput>(input),
        requestOptions(flags)
      )
    return { data: result }
  },
})

function inlineEmailCount(input: unknown): number | undefined {
  if (typeof input !== 'string' || input === '-') {
    return
  }
  try {
    const parsed: unknown = JSON.parse(input)
    if (Array.isArray(parsed)) {
      return parsed.length
    }
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { emails?: unknown }).emails)
    ) {
      return (parsed as { emails: unknown[] }).emails.length
    }
  } catch {}
}
