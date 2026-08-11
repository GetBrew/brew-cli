import { defineCommand } from '../../lib/define-command'
import { CliApiError } from '../../lib/errors'
import { flagString } from '../../lib/input'

export const emailsGetCommand = defineCommand({
  path: ['emails', 'get'],
  summary: 'Fetch one email design by id',
  sdkMethod: null,
  derivedFrom: 'emails.list',
  route: { method: 'GET', path: '/v1/emails' },
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
      summary: 'Comma-separated expansions: html,versions',
    },
  ],
  examples: [
    'brew-cli emails get eml_2SmZOWV3ZQ7W5x6g3m4p',
    'brew-cli emails get eml_2SmZOWV3ZQ7W5x6g3m4p --include html,versions',
  ],
  run: async ({ ctx, args, flags }) => {
    const emailId = args.emailId ?? ''
    const include = flagString(flags.include)
    const result = await ctx.client().emails.list({
      emailId,
      ...(include === undefined ? {} : { include }),
    })
    const email = result.data[0]
    if (email === undefined) {
      throw new CliApiError({
        status: 404,
        code: 'EMAIL_NOT_FOUND',
        type: 'not_found',
        message: `No email design found for ${emailId}`,
        suggestion: 'List designs with `brew-cli emails list`.',
      })
    }
    return { data: email }
  },
})
