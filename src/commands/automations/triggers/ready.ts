import type { components } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { rawRequest } from '../../../lib/raw-request'

type TriggerFireResponse = components['schemas']['TriggerFireResponse']

export const automationsTriggersReadyCommand = defineCommand({
  path: ['automations', 'triggers', 'ready'],
  summary:
    'Preflight a trigger without firing: key + scope + permissions pass/fail, the payload contract, and what a fire would start',
  sdkMethod: null,
  isRawTransport: true,
  route: {
    method: 'GET',
    path: '/v1/automations/triggers/{triggerEventId}/fire',
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
  // 200 `status: "ready"` means the exact credential in use can fire this
  // trigger; `details.counts.automations: 0` means fires are accepted and
  // logged but start no runs until a wired automation is published.
  run: async ({ ctx, args }) => {
    const result = await rawRequest<TriggerFireResponse>(ctx, {
      method: 'GET',
      path: `/v1/automations/triggers/${encodeURIComponent(args.triggerEventId ?? '')}/fire`,
    })
    return { data: result }
  },
})
