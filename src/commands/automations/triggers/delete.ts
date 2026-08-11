import { defineCommand } from '../../../lib/define-command'

export const automationsTriggersDeleteCommand = defineCommand({
  path: ['automations', 'triggers', 'delete'],
  summary: 'Delete a trigger event (rejected while automations depend on it)',
  sdkMethod: 'automations.triggers.delete',
  route: {
    method: 'DELETE',
    path: '/v1/automations/triggers/{triggerEventId}',
  },
  commandClass: 'destructive',
  args: [
    {
      name: 'triggerEventId',
      summary: 'Id of the trigger event to delete',
      isRequired: true,
    },
  ],
  examples: ['brew-cli automations triggers delete tev_123 --yes'],
  confirmSummary: ({ args }) =>
    `Delete trigger event ${args.triggerEventId ?? ''}. This cannot be undone (the server rejects the delete while automations still depend on it).`,
  run: async ({ ctx, args }) => ({
    data: await ctx.client().automations.triggers.delete({
      triggerEventId: args.triggerEventId ?? '',
    }),
  }),
})
