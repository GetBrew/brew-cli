import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { IDEMPOTENCY_FLAG, INPUT_FLAG } from '../../lib/input'
import { webhookRunner } from './request'

const route = { method: 'POST', path: '/v1/webhooks' } as const
type Output =
  operations['createWebhook']['responses'][201]['content']['application/json']

export const webhooksCreateCommand = defineCommand({
  path: ['webhooks', 'create'],
  summary: 'Create a webhook endpoint for the selected brand',
  sdkMethod: null,
  isRawTransport: true,
  route,
  commandClass: 'write',
  args: [],
  flags: [INPUT_FLAG, IDEMPOTENCY_FLAG],
  examples: [
    'brew-cli webhooks create --input \'{"endpoint":"https://example.com/hook","events":["email.delivered"]}\'',
  ],
  run: webhookRunner<Output>(route),
})
