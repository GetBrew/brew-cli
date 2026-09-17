import { defineCommand } from '../../../lib/define-command'

/**
 * `state` is `received | verified | matched | partially_fired | fired |
 * rejected | dead_letter`: `fired` means every matched automation started,
 * `partially_fired` that some starts are still being retried, and
 * `rejected` carries a `rejectionReason`.
 */
export const automationsTriggerInstancesGetCommand = defineCommand({
  path: ['automations', 'trigger-instances', 'get'],
  summary:
    'Fetch one fired-trigger instance by id — the bare row, with its lifecycle `state` and the runs it started',
  sdkMethod: 'automations.triggerInstances.get',
  route: {
    method: 'GET',
    path: '/v1/automations/trigger-instances/{triggerInstanceId}',
  },
  commandClass: 'read',
  args: [
    {
      name: 'triggerInstanceId',
      summary: 'Instance id returned by a fire, or by the instances list',
      isRequired: true,
    },
  ],
  examples: ['brew-cli automations trigger-instances get tin_2f1c9d8a'],
  run: async ({ ctx, args }) => ({
    data: await ctx
      .client()
      .automations.triggerInstances.get(args.triggerInstanceId ?? ''),
  }),
})
