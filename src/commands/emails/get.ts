import { defineCommand } from '../../lib/define-command'
import { flagString } from '../../lib/input'

export const emailsGetCommand = defineCommand({
  path: ['emails', 'get'],
  summary: 'Fetch one email design by id — the bare row',
  sdkMethod: 'emails.get',
  route: { method: 'GET', path: '/v1/emails/{emailId}' },
  commandClass: 'read',
  args: [
    {
      name: 'emailId',
      summary: 'Design id returned by emails generate/import',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--include <tokens>',
      summary: 'Comma-separated expansions: html, versions',
    },
  ],
  examples: [
    'brew-cli emails get eml_2SmZOWV3ZQ7W5x6g3m4p',
    'brew-cli emails get eml_2SmZOWV3ZQ7W5x6g3m4p --include html,versions',
  ],
  run: async ({ ctx, args, flags }) => {
    const include = flagString(flags.include)
    return {
      data: await ctx
        .client()
        .emails.get(
          args.emailId ?? '',
          include === undefined ? undefined : { include }
        ),
    }
  },
})
