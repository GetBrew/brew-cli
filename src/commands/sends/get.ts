import { defineCommand } from '../../lib/define-command'
import { flagString } from '../../lib/input'

export const sendsGetCommand = defineCommand({
  path: ['sends', 'get'],
  summary: 'Fetch one send by id — the bare row with its lifetime stats',
  sdkMethod: 'sends.get',
  route: { method: 'GET', path: '/v1/sends/{sendId}' },
  commandClass: 'read',
  args: [{ name: 'sendId', summary: 'Send id to fetch', isRequired: true }],
  flags: [
    {
      flag: '--include <tokens>',
      summary: 'Comma-separated expansions: events',
    },
  ],
  examples: [
    'brew-cli sends get snd_9f2kX',
    'brew-cli sends get snd_9f2kX --include events',
  ],
  run: async ({ ctx, args, flags }) => {
    const include = flagString(flags.include)
    return {
      data: await ctx
        .client()
        .sends.get(
          args.sendId ?? '',
          include === undefined ? undefined : { include }
        ),
    }
  },
})
