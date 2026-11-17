import type { UpdateWebhookInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { asSdkInput, INPUT_FLAG, requestOptions } from '../../lib/input'
import { prepareWebhookInput, WEBHOOK_ENDPOINT_FLAGS } from './request'

const route = { method: 'PATCH', path: '/v1/webhooks/{webhookId}' } as const

export const webhooksUpdateCommand = defineCommand({
  path: ['webhooks', 'update'],
  summary: 'Update a webhook endpoint or its event subscriptions',
  sdkMethod: 'webhooks.update',
  route,
  commandClass: 'write',
  args: [
    { name: 'webhookId', summary: 'Webhook endpoint ID', isRequired: true },
  ],
  flags: [
    INPUT_FLAG,
    ...WEBHOOK_ENDPOINT_FLAGS,
    { flag: '--status <status>', summary: 'enabled or disabled' },
  ],
  examples: [
    'brew-cli webhooks update ep_example --input \'{"status":"disabled"}\'',
  ],
  prepareInput: prepareWebhookInput,
  run: async ({ ctx, args, flags, input }) => ({
    data: await ctx.client().webhooks.update(
      asSdkInput<UpdateWebhookInput>({
        ...input,
        webhookId: args.webhookId ?? '',
      }),
      requestOptions(flags)
    ),
  }),
})
