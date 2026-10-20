import type { PatchAutomationInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'

export const automationsUpdateCommand = defineCommand({
  path: ['automations', 'update'],
  summary: 'Update automation metadata and/or its graph (PATCH)',
  sdkMethod: 'automations.patch',
  route: { method: 'PATCH', path: '/v1/automations/{automationId}' },
  commandClass: 'destructive',
  args: [
    {
      name: 'automationId',
      summary: 'Id of the automation to update',
      isRequired: true,
    },
  ],
  flags: [
    { flag: '--name <name>', summary: 'New name' },
    { flag: '--description <text>', summary: 'New description' },
    { flag: '--trigger <triggerEventId>', summary: 'New trigger event id' },
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli automations update am_123 --name "Welcome flow v2"',
    'cat graph.json | brew-cli automations update am_123 --input -',
  ],
  prepareInput: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      name: flagString(flags.name),
      description: flagString(flags.description),
      triggerEventId: flagString(flags.trigger),
    })
    if (Object.keys(input).length === 0) {
      throw new CliUsageError('Nothing to update — pass flags or --input.')
    }
    return input
  },
  confirmSummary: ({ args, input }) => {
    if (input?.dryRun === true) return undefined
    if (input?.stopInFlight === true) {
      return `Unpublish automation ${args.automationId} and permanently stop every contact already mid-flow?`
    }
    if (input?.published === true) {
      return `Publish automation ${args.automationId}? Its triggers will send real email.`
    }
    if (input?.paused === false) {
      return `Resume automation ${args.automationId}? Held contacts will continue and receive email.`
    }
    return undefined
  },
  run: async ({ ctx, args, input }) => {
    if (!input)
      throw new CliUsageError('Automation update input was not prepared.')
    const result = await ctx.client().automations.patch(
      asSdkInput<PatchAutomationInput>({
        ...input,
        automationId: args.automationId ?? '',
      })
    )
    return { data: result }
  },
})
