import type { WebhookAttemptsInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { asSdkInput, flagInt, flagString } from '../../lib/input'
import { CURSOR_FLAG, LIMIT_FLAG } from '../../lib/paginate'

const route = {
  method: 'GET',
  path: '/v1/webhooks/{webhookId}/events/{eventId}/attempts',
} as const

export const webhooksAttemptsCommand = defineCommand({
  path: ['webhooks', 'attempts'],
  summary: 'List HTTP delivery attempts for a webhook event',
  sdkMethod: 'webhooks.attempts',
  route,
  commandClass: 'read',
  args: [
    { name: 'webhookId', summary: 'Webhook endpoint ID', isRequired: true },
    { name: 'eventId', summary: 'Webhook delivery event ID', isRequired: true },
  ],
  flags: [LIMIT_FLAG, CURSOR_FLAG],
  examples: ['brew-cli webhooks attempts ep_example msg_example'],
  run: async ({ ctx, args, flags }) => ({
    data: await ctx.client().webhooks.attempts(
      asSdkInput<WebhookAttemptsInput>({
        webhookId: args.webhookId ?? '',
        eventId: args.eventId ?? '',
        limit: flagInt(flags.limit, '--limit'),
        cursor: flagString(flags.cursor),
      })
    ),
  }),
})
