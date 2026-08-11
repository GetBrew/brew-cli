import { defineCommand } from '../../lib/define-command'

export const automationsDeleteCommand = defineCommand({
  path: ['automations', 'delete'],
  summary: 'Delete an automation and its version history (cascade)',
  sdkMethod: 'automations.delete',
  route: { method: 'DELETE', path: '/v1/automations/{automationId}' },
  commandClass: 'destructive',
  args: [
    {
      name: 'automationId',
      summary: 'Id of the automation to delete',
      isRequired: true,
    },
  ],
  examples: ['brew-cli automations delete am_123 --yes'],
  confirmSummary: ({ args }) =>
    `Delete automation ${args.automationId ?? ''} and its entire version history (cascade). This cannot be undone.`,
  run: async ({ ctx, args }) => ({
    data: await ctx
      .client()
      .automations.delete({ automationId: args.automationId ?? '' }),
  }),
})
