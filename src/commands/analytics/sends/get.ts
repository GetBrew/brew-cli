import type { ListSendsInput } from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import { CliApiError } from '../../../lib/errors'
import { asSdkInput, flagString } from '../../../lib/input'

export const analyticsSendsGetCommand = defineCommand({
  path: ['analytics', 'sends', 'get'],
  summary: 'Fetch one send by id',
  sdkMethod: null,
  derivedFrom: 'analytics.sends.list',
  route: { method: 'GET', path: '/v1/analytics/sends' },
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
    const sendId = args.sendId ?? ''
    const include = flagString(flags.include)
    const result = await ctx.client().analytics.sends.list(
      asSdkInput<ListSendsInput>({
        sendId,
        ...(include === undefined ? {} : { include }),
      })
    )
    const send = result.data[0]
    if (send === undefined) {
      throw new CliApiError({
        status: 404,
        code: 'SEND_NOT_FOUND',
        type: 'not_found',
        message: `No send found for ${sendId}`,
        suggestion: 'List sends with `brew-cli analytics sends list`.',
      })
    }
    return { data: send }
  },
})
