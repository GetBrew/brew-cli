import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { webhookRunner } from './request'

const route = { method: 'DELETE', path: '/v1/webhooks/{webhookId}' } as const
type Output =
  operations['deleteWebhook']['responses'][200]['content']['application/json']

export const webhooksDeleteCommand = defineCommand({
  path: ['webhooks', 'delete'],
  summary: 'Delete a webhook endpoint and stop future deliveries',
  sdkMethod: null,
  isRawTransport: true,
  route,
  commandClass: 'destructive',
  args: [
    { name: 'webhookId', summary: 'Webhook endpoint ID', isRequired: true },
  ],
  flags: [],
  examples: ['brew-cli webhooks delete ep_example --yes'],
  confirmSummary: () =>
    'Delete the webhook endpoint and stop its pending deliveries.',
  run: webhookRunner<Output>(route),
})
