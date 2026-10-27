import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { CURSOR_FLAG, LIMIT_FLAG } from '../../lib/paginate'
import { webhookRunner } from './request'

const route = { method: 'GET', path: '/v1/webhooks' } as const
type Output =
  operations['listWebhooks']['responses'][200]['content']['application/json']

export const webhooksListCommand = defineCommand({
  path: ['webhooks', 'list'],
  summary: 'List webhook endpoints for the selected brand',
  sdkMethod: null,
  isRawTransport: true,
  route,
  commandClass: 'read',
  args: [],
  flags: [LIMIT_FLAG, CURSOR_FLAG],
  examples: ['brew-cli webhooks list'],
  run: webhookRunner<Output>(route),
})
