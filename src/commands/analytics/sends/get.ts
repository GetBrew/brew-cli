import { defineCommand } from '../../../lib/define-command'
import { flagString } from '../../../lib/input'

/** The name agents already know, now reading the real send detail row. */
export const analyticsSendsGetCommand = defineCommand({
  path: ['analytics', 'sends', 'get'],
  summary: 'Fetch one send by id — the bare row (`sends get`)',
  sdkMethod: null,
  derivedFrom: 'sends.get',
  route: { method: 'GET', path: '/v1/sends/{sendId}' },
  commandClass: 'read',
  args: [
    {
      name: 'sendId',
      summary: 'Id of the send',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--include <tokens>',
      summary: 'Comma-separated expansions: events',
    },
  ],
  examples: [
    'brew-cli analytics sends get snd_123',
    'brew-cli analytics sends get snd_123 --include events',
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
