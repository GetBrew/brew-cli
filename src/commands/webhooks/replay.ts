import { defineCommand } from '../../lib/define-command'
import { IDEMPOTENCY_FLAG, INPUT_FLAG, requestOptions } from '../../lib/input'
import { prepareWebhookInput } from './request'

const route = {
  method: 'POST',
  path: '/v1/webhooks/{webhookId}/events/{eventId}/replay',
} as const

export const webhooksReplayCommand = defineCommand({
  path: ['webhooks', 'replay'],
  summary: 'Replay a webhook event without resending the email',
  sdkMethod: 'webhooks.replay',
  route,
  commandClass: 'destructive',
  args: [
    { name: 'webhookId', summary: 'Webhook endpoint ID', isRequired: true },
    { name: 'eventId', summary: 'Webhook delivery event ID', isRequired: true },
  ],
  flags: [INPUT_FLAG, IDEMPOTENCY_FLAG],
  examples: ['brew-cli webhooks replay ep_example msg_example --yes'],
  confirmSummary: () =>
    'Deliver the original webhook event again. This does not resend the email.',
  prepareInput: prepareWebhookInput,
  run: async ({ ctx, args, flags }) => ({
    data: await ctx
      .client()
      .webhooks.replay(
        args.webhookId ?? '',
        args.eventId ?? '',
        requestOptions(flags)
      ),
  }),
})
