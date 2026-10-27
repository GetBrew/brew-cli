import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { INPUT_FLAG } from '../../lib/input'
import {
  prepareWebhookInput,
  WEBHOOK_ENDPOINT_FLAGS,
  webhookRunner,
} from './request'

const route = { method: 'PATCH', path: '/v1/webhooks/{webhookId}' } as const
type Output =
  operations['updateWebhook']['responses'][200]['content']['application/json']
type Input =
  operations['updateWebhook']['requestBody']['content']['application/json']

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
  flags: [
    INPUT_FLAG,
    ...WEBHOOK_ENDPOINT_FLAGS,
    { flag: '--status <status>', summary: 'enabled or disabled' },
  ],
  examples: [
    'brew-cli webhooks update ep_example --input \'{"status":"disabled"}\'',
  ],
  prepareInput: prepareWebhookInput,
  run: webhookRunner<Output, Input>(route),
})
