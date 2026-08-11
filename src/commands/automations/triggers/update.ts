import type { PatchTriggerInput } from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import {
  asSdkInput,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../../lib/input'

export const automationsTriggersUpdateCommand = defineCommand({
  path: ['automations', 'triggers', 'update'],
  summary: 'Update a trigger event (title, description, payload schema)',
  sdkMethod: 'automations.triggers.patch',
  route: {
    method: 'PATCH',
    path: '/v1/automations/triggers/{triggerEventId}',
  },
  commandClass: 'write',
  args: [
    {
      name: 'triggerEventId',
      summary: 'Id of the trigger event to update',
      isRequired: true,
    },
  ],
  flags: [
    { flag: '--title <title>', summary: 'New title' },
    { flag: '--description <text>', summary: 'New description' },
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli automations triggers update tev_123 --title user.signup.v2',
    `brew-cli automations triggers update tev_123 --input '{"payloadSchema":{"type":"object","fields":[]}}'`,
  ],
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      title: flagString(flags.title),
      description: flagString(flags.description),
    })
    if (Object.keys(input).length === 0) {
      throw new CliUsageError('Nothing to update — pass flags or --input.')
    }
    const result = await ctx.client().automations.triggers.patch(
      asSdkInput<PatchTriggerInput>({
        ...input,
        triggerEventId: args.triggerEventId ?? '',
      })
    )
    return { data: result }
  },
})
