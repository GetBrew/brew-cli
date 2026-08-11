import { defineCommand } from '../../lib/define-command'
import { flagString } from '../../lib/input'

export const automationsPublishCommand = defineCommand({
  path: ['automations', 'publish'],
  summary:
    'Publish an automation — arms it for live fires; does not itself send',
  sdkMethod: 'automations.publish',
  route: { method: 'PATCH', path: '/v1/automations/{automationId}' },
  commandClass: 'write',
  args: [
    {
      name: 'automationId',
      summary: 'Id of the automation to publish',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--automation-version <automationVersionId>',
      summary: 'Publish a specific historical version (default: latest)',
    },
  ],
  examples: [
    'brew-cli automations publish am_123',
    'brew-cli automations publish am_123 --automation-version amv_456',
  ],
  run: async ({ ctx, args, flags }) => {
    const automationVersionId = flagString(flags.automationVersion)
    const result = await ctx.client().automations.publish({
      automationId: args.automationId ?? '',
      ...(automationVersionId === undefined ? {} : { automationVersionId }),
    })
    return { data: result }
  },
})
