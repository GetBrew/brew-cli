import type { CreateFieldInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import { flagString, IDEMPOTENCY_FLAG, requestOptions } from '../../lib/input'

const FIELD_TYPES = ['string', 'number', 'date', 'bool'] as const

export const fieldsCreateCommand = defineCommand({
  path: ['fields', 'create'],
  summary: 'Create a custom contact field',
  sdkMethod: 'fields.create',
  route: { method: 'POST', path: '/v1/fields' },
  commandClass: 'write',
  flags: [
    { flag: '--name <name>', summary: 'Field name (camelCase)' },
    {
      flag: '--type <type>',
      summary: 'Field type: string | number | date | bool',
    },
    IDEMPOTENCY_FLAG,
  ],
  examples: ['brew-cli fields create --name plan --type string'],
  run: async ({ ctx, flags }) => {
    const fieldName = flagString(flags.name)
    const fieldType = flagString(flags.type)
    if (fieldName === undefined || fieldType === undefined) {
      throw new CliUsageError('--name and --type are required.')
    }
    if (!(FIELD_TYPES as readonly string[]).includes(fieldType)) {
      throw new CliUsageError(
        `--type must be one of: ${FIELD_TYPES.join(', ')}`
      )
    }
    // Typed literal on purpose — no asSdkInput cast, so the compiler holds
    // this body to the generated contract (wire names are fieldName/fieldType).
    const input: CreateFieldInput = {
      fieldName,
      fieldType: fieldType as CreateFieldInput['fieldType'],
    }
    const result = await ctx
      .client()
      .fields.create(input, requestOptions(flags))
    return { data: result }
  },
})
