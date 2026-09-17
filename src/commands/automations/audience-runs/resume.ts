import { defineCommand } from '../../../lib/define-command'
import { IDEMPOTENCY_FLAG, requestOptions } from '../../../lib/input'

export const automationsAudienceRunsResumeCommand = defineCommand({
  path: ['automations', 'audience-runs', 'resume'],
  summary:
    'Resume a paused manual-audience run, or restart a failed one from its first undelivered send',
  sdkMethod: 'automations.audienceRuns.resume',
  route: {
    method: 'POST',
    path: '/v1/automations/audience-runs/{audienceRunId}/resume',
  },
  commandClass: 'write',
  args: [
    {
      name: 'audienceRunId',
      summary: 'Audience run id to resume',
      isRequired: true,
    },
  ],
  flags: [IDEMPOTENCY_FLAG],
  // `resumedFrom` on the response reports which case ran: `paused` or
  // `failed`. A failed restart never resends a step the failed run finished.
  examples: ['brew-cli automations audience-runs resume arun_01HZ'],
  run: async ({ ctx, args, flags }) => ({
    data: await ctx
      .client()
      .automations.audienceRuns.resume(
        args.audienceRunId ?? '',
        requestOptions(flags)
      ),
  }),
})
