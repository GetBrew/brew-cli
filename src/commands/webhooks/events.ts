import type { WebhookEventsInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { asSdkInput, flagInt, flagString } from '../../lib/input'
import { CURSOR_FLAG, LIMIT_FLAG } from '../../lib/paginate'

const route = {
  method: 'GET',
  path: '/v1/webhooks/{webhookId}/events',
} as const

export const webhooksEventsCommand = defineCommand({
  path: ['webhooks', 'events'],
  summary: 'List delivery history and payloads for a webhook endpoint',
  sdkMethod: 'webhooks.events',
  route,
  commandClass: 'read',
  args: [
    { name: 'webhookId', summary: 'Webhook endpoint ID', isRequired: true },
  ],
  flags: [LIMIT_FLAG, CURSOR_FLAG],
  examples: ['brew-cli webhooks events ep_example'],
  run: async ({ ctx, args, flags }) => ({
    data: await ctx.client().webhooks.events(
      asSdkInput<WebhookEventsInput>({
        webhookId: args.webhookId ?? '',
        limit: flagInt(flags.limit, '--limit'),
        cursor: flagString(flags.cursor),
      })
    ),
  }),
})
