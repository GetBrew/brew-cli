import { defineCommand } from '../../lib/define-command'
import { IDEMPOTENCY_FLAG, INPUT_FLAG, requestOptions } from '../../lib/input'
import { prepareWebhookInput } from './request'

const route = {
  method: 'POST',
  path: '/v1/webhooks/{webhookId}/rotate-secret',
} as const

export const webhooksRotateSecretCommand = defineCommand({
  path: ['webhooks', 'rotate-secret'],
  summary: 'Rotate the signing secret for a webhook endpoint',
  sdkMethod: 'webhooks.rotateSecret',
  route,
  commandClass: 'destructive',
  args: [
    { name: 'webhookId', summary: 'Webhook endpoint ID', isRequired: true },
  ],
  flags: [INPUT_FLAG, IDEMPOTENCY_FLAG],
  examples: ['brew-cli webhooks rotate-secret ep_example --yes'],
  confirmSummary: () =>
    'Rotate the endpoint signing secret. Update your receiver with the new secret.',
  prepareInput: prepareWebhookInput,
  run: async ({ ctx, args, flags }) => ({
    data: await ctx
      .client()
      .webhooks.rotateSecret(args.webhookId ?? '', requestOptions(flags)),
  }),
})
