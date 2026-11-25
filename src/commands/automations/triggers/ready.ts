import { defineCommand } from '../../../lib/define-command'

export const automationsTriggersReadyCommand = defineCommand({
  path: ['automations', 'triggers', 'ready'],
  summary:
    'Preflight a trigger without firing: key + scope + permissions pass/fail, the payload contract, what a fire would start, and (integration triggers) whether Brew has received the event',
  sdkMethod: 'automations.triggers.readiness',
  route: {
    method: 'GET',
    path: '/v1/automations/triggers/{triggerEventId}/readiness',
  },
  commandClass: 'read',
  args: [
    {
      name: 'triggerEventId',
      summary: 'Trigger id (tri_…, or an integration composite id)',
      isRequired: true,
    },
  ],
  examples: [
    'brew-cli automations triggers ready tri_signup',
    'brew-cli automations triggers ready shopify:customers/update --json',
  ],
  run: async ({ ctx, args }) => ({
    data: await ctx
      .client()
      .automations.triggers.readiness(args.triggerEventId ?? ''),
  }),
})
