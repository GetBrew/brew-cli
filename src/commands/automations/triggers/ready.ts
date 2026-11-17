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
  // 200 `ready: true` means the exact credential in use can fire this
  // trigger. A `NO_PUBLISHED_AUTOMATION` blocker with `ready: false` means
  // fires are refused with 422 NO_PUBLISHED_AUTOMATION until a wired
  // automation is published. The readiness probe returns 200 with the blocker.
  // An integration trigger may also carry `delivery` (received |
  // never_received | none_recent | waiting_for_test_event + what to set up at
  // the source); it never changes `ready`.
  run: async ({ ctx, args }) => ({
    data: await ctx
      .client()
      .automations.triggers.readiness(args.triggerEventId ?? ''),
  }),
})
