import { defineCommand } from '../../../lib/define-command'
import { IDEMPOTENCY_FLAG, requestOptions } from '../../../lib/input'

export const automationsAudienceRunsPauseCommand = defineCommand({
  path: ['automations', 'audience-runs', 'pause'],
  summary:
    'Pause a running manual-audience run at its next step boundary (resumable)',
  sdkMethod: 'automations.audienceRuns.pause',
  route: {
    method: 'POST',
    path: '/v1/automations/audience-runs/{audienceRunId}/pause',
  },
  commandClass: 'write',
  args: [
    {
      name: 'audienceRunId',
      summary: 'Audience run id to pause',
      isRequired: true,
    },
  ],
  flags: [IDEMPOTENCY_FLAG],
  examples: ['brew-cli automations audience-runs pause arun_01HZ'],
  run: async ({ ctx, args, flags }) => ({
    data: await ctx
      .client()
      .automations.audienceRuns.pause(
        args.audienceRunId ?? '',
        requestOptions(flags)
      ),
  }),
})
