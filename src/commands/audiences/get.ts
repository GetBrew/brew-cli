import { defineCommand } from '../../lib/define-command'
import { flagString } from '../../lib/input'

export const audiencesGetCommand = defineCommand({
  path: ['audiences', 'get'],
  summary: 'Fetch one audience segment by id — the bare row',
  sdkMethod: 'audiences.get',
  route: { method: 'GET', path: '/v1/audiences/{audienceId}' },
  commandClass: 'read',
  args: [
    { name: 'audienceId', summary: 'Audience id to fetch', isRequired: true },
  ],
  flags: [
    {
      flag: '--include <tokens>',
      summary: 'Comma-separated expansions: count, build',
    },
  ],
  examples: [
    'brew-cli audiences get aud_3k9sQ',
    'brew-cli audiences get aud_3k9sQ --include count,build',
  ],
  run: async ({ ctx, args, flags }) => {
    const include = flagString(flags.include)
    return {
      data: await ctx
        .client()
        .audiences.get(
          args.audienceId ?? '',
          include === undefined ? undefined : { include }
        ),
    }
  },
})
