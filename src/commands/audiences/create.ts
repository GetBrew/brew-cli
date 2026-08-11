import type { CreateAudienceInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  requestOptions,
} from '../../lib/input'

export const audiencesCreateCommand = defineCommand({
  path: ['audiences', 'create'],
  summary: 'Create an audience segment from a filter definition',
  sdkMethod: 'audiences.create',
  route: { method: 'POST', path: '/v1/audiences' },
  commandClass: 'write',
  flags: [
    { flag: '--name <name>', summary: 'Audience name' },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    `brew-cli audiences create --name VIP --input '{"filters":{"filters":[{"field":"plan","operator":"equals","value":"vip"}],"logicalOperator":"and"}}'`,
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, { name: flagString(flags.name) })
    if (typeof input.name !== 'string' || input.name === '') {
      throw new CliUsageError('--name is required (or provide it via --input).')
    }
    if (input.filters === undefined) {
      throw new CliUsageError(
        'Audience filters are required — pass the filter definition via --input.'
      )
    }
    const result = await ctx
      .client()
      .audiences.create(
        asSdkInput<CreateAudienceInput>(input),
        requestOptions(flags)
      )
    return { data: result }
  },
})
