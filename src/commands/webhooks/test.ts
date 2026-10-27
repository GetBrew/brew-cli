import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { IDEMPOTENCY_FLAG, INPUT_FLAG } from '../../lib/input'
import { prepareWebhookInput, webhookRunner } from './request'

const route = { method: 'POST', path: '/v1/webhooks/{webhookId}/test' } as const
type Output =
  operations['testWebhook']['responses'][202]['content']['application/json']
type Input =
  operations['testWebhook']['requestBody']['content']['application/json']

export const webhooksTestCommand = defineCommand({
  path: ['webhooks', 'test'],
  summary: 'Send a synthetic webhook event to an endpoint',
  sdkMethod: null,
  isRawTransport: true,
  route,
  commandClass: 'destructive',
  args: [
    { name: 'webhookId', summary: 'Webhook endpoint ID', isRequired: true },
  ],
  flags: [
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
    { flag: '--type <type>', summary: 'Email webhook event type to send' },
  ],
  examples: [
    'brew-cli webhooks test ep_example --input \'{"type":"email.delivered"}\' --yes',
  ],
  confirmSummary: () =>
    'Send a synthetic webhook event to the endpoint. This does not send an email.',
  prepareInput: prepareWebhookInput,
  run: webhookRunner<Output, Input>(route),
})
