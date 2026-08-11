import { defineCommand } from '../../lib/define-command'

export const automationsUnpublishCommand = defineCommand({
  path: ['automations', 'unpublish'],
  summary: 'Unpublish an automation so new trigger fires no longer start runs',
  sdkMethod: 'automations.unpublish',
  route: { method: 'PATCH', path: '/v1/automations/{automationId}' },
  commandClass: 'write',
  args: [
    {
      name: 'automationId',
      summary: 'Id of the automation to unpublish',
      isRequired: true,
    },
  ],
  examples: ['brew-cli automations unpublish am_123'],
  run: async ({ ctx, args }) => ({
    data: await ctx
      .client()
      .automations.unpublish({ automationId: args.automationId ?? '' }),
  }),
})
