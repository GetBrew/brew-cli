import { defineCommand } from '../../lib/define-command'
import { flagString } from '../../lib/input'

export const automationsGetCommand = defineCommand({
  path: ['automations', 'get'],
  summary: 'Fetch one automation by id — the bare row, lean by default',
  sdkMethod: 'automations.get',
  route: { method: 'GET', path: '/v1/automations/{automationId}' },
  commandClass: 'read',
  args: [
    {
      name: 'automationId',
      summary: 'Id of the automation',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--include <tokens>',
      summary: 'Comma-separated expansions: graph, versions',
    },
  ],
  examples: [
    'brew-cli automations get am_123',
    'brew-cli automations get am_123 --include graph,versions',
  ],
  run: async ({ ctx, args, flags }) => {
    const include = flagString(flags.include)
    return {
      data: await ctx
        .client()
        .automations.get(
          args.automationId ?? '',
          include === undefined ? undefined : { include }
        ),
    }
  },
})
