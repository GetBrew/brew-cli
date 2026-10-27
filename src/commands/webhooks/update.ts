import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { INPUT_FLAG } from '../../lib/input'
import { webhookRunner } from './request'

const route = { method: 'PATCH', path: '/v1/webhooks/{webhookId}' } as const
type Output =
  operations['updateWebhook']['responses'][200]['content']['application/json']

export const webhooksUpdateCommand = defineCommand({
  path: ['webhooks', 'update'],
  summary: 'Update a webhook endpoint or its event subscriptions',
  sdkMethod: null,
  isRawTransport: true,
  route,
  commandClass: 'write',
  args: [
    { name: 'webhookId', summary: 'Webhook endpoint ID', isRequired: true },
  ],
  flags: [INPUT_FLAG],
  examples: [
    'brew-cli webhooks update ep_example --input \'{"status":"disabled"}\'',
  ],
  run: webhookRunner<Output>(route),
})
