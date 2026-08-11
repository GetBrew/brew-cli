import { defineCommand } from '../../lib/define-command'
import { CliApiError } from '../../lib/errors'
import { flagString } from '../../lib/input'

export const audiencesGetCommand = defineCommand({
  path: ['audiences', 'get'],
  summary: 'Fetch one audience segment by id',
  sdkMethod: null,
  derivedFrom: 'audiences.list',
  route: { method: 'GET', path: '/v1/audiences' },
  commandClass: 'read',
  args: [
    { name: 'audienceId', summary: 'Audience id to fetch', isRequired: true },
  ],
  flags: [
    {
      flag: '--include <tokens>',
      summary: 'Comma-separated expansions: count',
    },
  ],
  examples: ['brew-cli audiences get aud_3k9sQ'],
  run: async ({ ctx, args, flags }) => {
    const audienceId = args.audienceId ?? ''
    const include = flagString(flags.include)
    const result = await ctx.client().audiences.list({
      audienceId,
      ...(include === undefined ? {} : { include }),
    })
    const audience = result.data[0]
    if (audience === undefined) {
      throw new CliApiError({
        status: 404,
        code: 'AUDIENCE_NOT_FOUND',
        type: 'not_found',
        message: `No audience found for ${audienceId}`,
        suggestion: 'List audiences with `brew-cli audiences list`.',
      })
    }
    return { data: audience }
  },
})
