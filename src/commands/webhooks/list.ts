import type { WebhookListInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { asSdkInput, flagInt, flagString } from '../../lib/input'
import { CURSOR_FLAG, LIMIT_FLAG } from '../../lib/paginate'

const route = { method: 'GET', path: '/v1/webhooks' } as const

export const webhooksListCommand = defineCommand({
  path: ['webhooks', 'list'],
  summary: 'List webhook endpoints for the selected brand',
  sdkMethod: 'webhooks.list',
  route,
  commandClass: 'read',
  args: [],
  flags: [LIMIT_FLAG, CURSOR_FLAG],
  examples: ['brew-cli webhooks list'],
  run: async ({ ctx, flags }) => ({
    data: await ctx.client().webhooks.list(
      asSdkInput<WebhookListInput>({
        limit: flagInt(flags.limit, '--limit'),
        cursor: flagString(flags.cursor),
      })
    ),
  }),
})
