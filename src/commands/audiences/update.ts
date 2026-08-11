import type { UpdateAudienceInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'

export const audiencesUpdateCommand = defineCommand({
  path: ['audiences', 'update'],
  summary: 'Update an audience segment (name and/or filters)',
  sdkMethod: 'audiences.update',
  route: { method: 'PATCH', path: '/v1/audiences/{audienceId}' },
  commandClass: 'write',
  args: [
    { name: 'audienceId', summary: 'Audience id to update', isRequired: true },
  ],
  flags: [{ flag: '--name <name>', summary: 'New audience name' }, INPUT_FLAG],
  examples: [
    'brew-cli audiences update aud_3k9sQ --name "VIP customers"',
    `brew-cli audiences update aud_3k9sQ --input '{"filters":{"filters":[{"field":"plan","operator":"equals","value":"vip"}],"logicalOperator":"and"}}'`,
  ],
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, { name: flagString(flags.name) })
    if (Object.keys(input).length === 0) {
      throw new CliUsageError('Nothing to update — pass --name or --input.')
    }
    const result = await ctx.client().audiences.update(
      asSdkInput<UpdateAudienceInput>({
        audienceId: args.audienceId ?? '',
        ...input,
      })
    )
    return { data: result }
  },
})
