import { defineCommand } from '../../../lib/define-command'

export const automationsTriggersReadyCommand = defineCommand({
  path: ['automations', 'triggers', 'ready'],
  summary:
    'Preflight a trigger without firing: key + scope + permissions pass/fail, the payload contract, and what a fire would start',
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
  examples: ['brew-cli automations triggers ready tri_signup'],
  // 200 `ready: true` means the exact credential in use can fire this
  // trigger. A `NO_PUBLISHED_AUTOMATION` blocker with `ready: false` means
  // fires are accepted and logged but start no runs until a wired
  // automation is published — still a 200, because a probe has to say why.
  run: async ({ ctx, args }) => ({
    data: await ctx
      .client()
      .automations.triggers.readiness(args.triggerEventId ?? ''),
  }),
})
