import { defineCommand } from '../../../lib/define-command'

export const automationsAudienceRunsGetCommand = defineCommand({
  path: ['automations', 'audience-runs', 'get'],
  summary: 'Fetch one manual-audience run by id — the bare row',
  sdkMethod: 'automations.audienceRuns.get',
  route: {
    method: 'GET',
    path: '/v1/automations/audience-runs/{audienceRunId}',
  },
  commandClass: 'read',
  args: [
    {
      name: 'audienceRunId',
      summary: 'Audience run id to fetch',
      isRequired: true,
    },
  ],
  examples: ['brew-cli automations audience-runs get arun_01HZ'],
  run: async ({ ctx, args }) => ({
    data: await ctx
      .client()
      .automations.audienceRuns.get(args.audienceRunId ?? ''),
  }),
})
