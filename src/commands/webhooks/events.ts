import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { CURSOR_FLAG, LIMIT_FLAG } from '../../lib/paginate'
import { webhookRunner } from './request'

const route = {
  method: 'GET',
  path: '/v1/webhooks/{webhookId}/events',
} as const
type Output =
  operations['listWebhookEvents']['responses'][200]['content']['application/json']

export const webhooksEventsCommand = defineCommand({
  path: ['webhooks', 'events'],
  summary: 'List delivery history and payloads for a webhook endpoint',
  sdkMethod: null,
  isRawTransport: true,
  route,
  commandClass: 'read',
  args: [
    { name: 'webhookId', summary: 'Webhook endpoint ID', isRequired: true },
  ],
  flags: [LIMIT_FLAG, CURSOR_FLAG],
  examples: ['brew-cli webhooks events ep_example'],
  run: webhookRunner<Output>(route),
})
