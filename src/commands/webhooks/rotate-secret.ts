import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { IDEMPOTENCY_FLAG, INPUT_FLAG } from '../../lib/input'
import { webhookRunner } from './request'

const route = {
  method: 'POST',
  path: '/v1/webhooks/{webhookId}/rotate-secret',
} as const
type Output =
  operations['rotateWebhookSecret']['responses'][200]['content']['application/json']

export const webhooksRotateSecretCommand = defineCommand({
  path: ['webhooks', 'rotate-secret'],
  summary: 'Rotate the signing secret for a webhook endpoint',
  sdkMethod: null,
  isRawTransport: true,
  route,
  commandClass: 'destructive',
  args: [
    { name: 'webhookId', summary: 'Webhook endpoint ID', isRequired: true },
  ],
  flags: [INPUT_FLAG, IDEMPOTENCY_FLAG],
  examples: ['brew-cli webhooks rotate-secret ep_example --yes'],
  confirmSummary: () =>
    'Rotate the endpoint signing secret. Update your receiver with the new secret.',
  run: webhookRunner<Output>(route),
})
