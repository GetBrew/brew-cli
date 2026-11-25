import { defineCommand } from '../../lib/define-command'

export const insightsGetCommand = defineCommand({
  path: ['insights', 'get'],
  summary:
    'Fetch one Brew Insights finding in full: rationale, frozen metrics, evidence, method',
  sdkMethod: 'insights.get',
  route: { method: 'GET', path: '/v1/insights/{insightId}' },
  commandClass: 'read',
  args: [
    {
      name: 'insightId',
      summary: 'The insightId an `insights list` row carries',
      isRequired: true,
    },
  ],
  examples: [
    'brew-cli insights get k17a8m2v4w5x6y7z8a9b0c1d2e3f4g5h',
    'brew-cli insights get k17a8m2v4w5x6y7z8a9b0c1d2e3f4g5h --json | jq .metrics',
  ],
  run: async ({ ctx, args }) => ({
    data: await ctx.client().insights.get(args.insightId ?? ''),
  }),
})
