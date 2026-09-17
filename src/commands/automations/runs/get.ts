import { defineCommand } from '../../../lib/define-command'
import { flagString } from '../../../lib/input'

export const automationsRunsGetCommand = defineCommand({
  path: ['automations', 'runs', 'get'],
  summary: 'Fetch one automation run by id — the bare row',
  sdkMethod: 'automations.runs.get',
  route: { method: 'GET', path: '/v1/automations/runs/{automationRunId}' },
  commandClass: 'read',
  args: [
    {
      name: 'automationRunId',
      summary: 'Run id (from `automations runs list`, a test start, or a fire)',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--include <tokens>',
      summary: 'Expansions: logs (newest 100 per-node execution logs)',
    },
  ],
  examples: [
    'brew-cli automations runs get run_9f2kX',
    'brew-cli automations runs get run_9f2kX --include logs',
  ],
  run: async ({ ctx, args, flags }) => {
    const include = flagString(flags.include)
    return {
      data: await ctx
        .client()
        .automations.runs.get(
          args.automationRunId ?? '',
          include === undefined ? undefined : { include }
        ),
    }
  },
})
