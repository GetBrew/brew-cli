import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { webhookRunner } from './request'

const route = { method: 'GET', path: '/v1/webhooks/{webhookId}' } as const
type Output =
  operations['getWebhook']['responses'][200]['content']['application/json']

export const webhooksGetCommand = defineCommand({
  path: ['webhooks', 'get'],
  summary: 'Get a webhook endpoint without revealing its signing secret',
  sdkMethod: null,
  isRawTransport: true,
  route,
  commandClass: 'read',
  args: [
    { name: 'webhookId', summary: 'Webhook endpoint ID', isRequired: true },
  ],
  flags: [],
  examples: ['brew-cli webhooks get ep_example'],
  run: webhookRunner<Output>(route),
})
