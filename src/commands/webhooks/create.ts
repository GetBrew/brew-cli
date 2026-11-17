import type { CreateWebhookInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import {
  asSdkInput,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  requestOptions,
} from '../../lib/input'
import { prepareWebhookInput, WEBHOOK_ENDPOINT_FLAGS } from './request'

const route = { method: 'POST', path: '/v1/webhooks' } as const

export const webhooksCreateCommand = defineCommand({
  path: ['webhooks', 'create'],
  summary: 'Create a webhook endpoint for the selected brand',
  sdkMethod: 'webhooks.create',
  route,
  commandClass: 'write',
  args: [],
  flags: [INPUT_FLAG, IDEMPOTENCY_FLAG, ...WEBHOOK_ENDPOINT_FLAGS],
  examples: [
    'brew-cli webhooks create --endpoint https://example.com/hook --events email.delivered,email.bounced',
    'brew-cli webhooks create --input \'{"endpoint":"https://example.com/hook","events":["email.delivered"]}\'',
  ],
  prepareInput: prepareWebhookInput,
  run: async ({ ctx, flags, input }) => ({
    data: await ctx
      .client()
      .webhooks.create(
        asSdkInput<CreateWebhookInput>(input),
        requestOptions(flags)
      ),
  }),
})
