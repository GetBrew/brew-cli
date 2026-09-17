import { defineCommand } from '../../../lib/define-command'

export const automationsAudienceRunsCancelCommand = defineCommand({
  path: ['automations', 'audience-runs', 'cancel'],
  summary: 'Cancel a manual-audience run for good — it can never be resumed',
  sdkMethod: 'automations.audienceRuns.cancel',
  route: {
    method: 'POST',
    path: '/v1/automations/audience-runs/{audienceRunId}/cancel',
  },
  commandClass: 'destructive',
  args: [
    {
      name: 'audienceRunId',
      summary: 'Audience run id to cancel',
      isRequired: true,
    },
  ],
  examples: ['brew-cli automations audience-runs cancel arun_01HZ --yes'],
  confirmSummary: ({ args }) =>
    `Cancel audience run ${args.audienceRunId ?? ''} for good. Emails already sent are not recalled, and a canceled run cannot be resumed.`,
  run: async ({ ctx, args }) => ({
    data: await ctx
      .client()
      .automations.audienceRuns.cancel(args.audienceRunId ?? ''),
  }),
})
