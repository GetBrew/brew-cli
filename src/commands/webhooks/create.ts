import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { IDEMPOTENCY_FLAG, INPUT_FLAG } from '../../lib/input'
import {
  prepareWebhookInput,
  WEBHOOK_ENDPOINT_FLAGS,
  webhookRunner,
} from './request'

const route = { method: 'POST', path: '/v1/webhooks' } as const
type Output =
  operations['createWebhook']['responses'][201]['content']['application/json']
type Input =
  operations['createWebhook']['requestBody']['content']['application/json']

export const webhooksCreateCommand = defineCommand({
  path: ['webhooks', 'create'],
  summary: 'Create a webhook endpoint for the selected brand',
  sdkMethod: null,
  isRawTransport: true,
  route,
  commandClass: 'write',
  args: [],
  flags: [INPUT_FLAG, IDEMPOTENCY_FLAG, ...WEBHOOK_ENDPOINT_FLAGS],
  examples: [
    'brew-cli webhooks create --input \'{"endpoint":"https://example.com/hook","events":["email.delivered"]}\'',
  ],
  prepareInput: prepareWebhookInput,
  run: webhookRunner<Output, Input>(route),
})
