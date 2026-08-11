import type { CreateFieldInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  requestOptions,
} from '../../lib/input'

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
    const name = flagString(flags.name)
    const type = flagString(flags.type)
    if (name === undefined || type === undefined) {
      throw new CliUsageError('--name and --type are required.')
    }
    const result = await ctx
      .client()
      .fields.create(
        asSdkInput<CreateFieldInput>({ name, type }),
        requestOptions(flags)
      )
    return { data: result }
  },
})
