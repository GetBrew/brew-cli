import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { ALL_FLAG, CURSOR_FLAG, LIMIT_FLAG } from '../../lib/paginate'
import { readGoalPage } from './shared'

type Row =
  operations['listAgentGoals']['responses'][200]['content']['application/json']['data'][number]

export const agentGoalsListCommand = defineCommand({
  path: ['agent-goals', 'list'],
  summary: 'List marketing goal records',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/agent-goals' },
  commandClass: 'read',
  flags: [LIMIT_FLAG, CURSOR_FLAG, ALL_FLAG],
  examples: ['brew-cli agent-goals list --all'],
  run: (invocation) => readGoalPage<Row>(invocation, '/v1/agent-goals'),
})
