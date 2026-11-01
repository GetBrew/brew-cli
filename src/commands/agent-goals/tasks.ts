import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { ALL_FLAG, CURSOR_FLAG, LIMIT_FLAG } from '../../lib/paginate'
import { GOAL_ID_ARG, goalPath, readGoalPage } from './shared'

type Row =
  operations['listAgentGoalTasks']['responses'][200]['content']['application/json']['data'][number]

export const agentGoalsTasksCommand = defineCommand({
  path: ['agent-goals', 'tasks'],
  summary: 'List marketing goal tasks',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/agent-goals/{goalId}/tasks' },
  commandClass: 'read',
  args: [GOAL_ID_ARG],
  flags: [LIMIT_FLAG, CURSOR_FLAG, ALL_FLAG],
  examples: ['brew-cli agent-goals tasks goal_123 --all'],
  run: (invocation) =>
    readGoalPage<Row>(
      invocation,
      `${goalPath(invocation.args.goalId ?? '')}/tasks`
    ),
})
