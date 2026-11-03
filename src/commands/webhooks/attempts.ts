import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { CURSOR_FLAG, LIMIT_FLAG } from '../../lib/paginate'
import { webhookRunner } from './request'

const route = {
  method: 'GET',
  path: '/v1/webhooks/{webhookId}/events/{eventId}/attempts',
} as const
type Output =
  operations['listWebhookAttempts']['responses'][200]['content']['application/json']

export const webhooksAttemptsCommand = defineCommand({
  path: ['webhooks', 'attempts'],
  summary: 'List HTTP delivery attempts for a webhook event',
  sdkMethod: null,
  isRawTransport: true,
  route,
  commandClass: 'read',
  args: [
    { name: 'webhookId', summary: 'Webhook endpoint ID', isRequired: true },
    { name: 'eventId', summary: 'Webhook delivery event ID', isRequired: true },
  ],
  flags: [LIMIT_FLAG, CURSOR_FLAG],
  examples: ['brew-cli webhooks attempts ep_example msg_example'],
  run: webhookRunner<Output>(route),
})
