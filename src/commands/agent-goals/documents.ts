import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { ALL_FLAG, CURSOR_FLAG } from '../../lib/paginate'
import { GOAL_ID_ARG, goalPath, readGoalPage } from './shared'

type Row =
  operations['listAgentGoalDocuments']['responses'][200]['content']['application/json']['data'][number]

export const agentGoalsDocumentsCommand = defineCommand({
  path: ['agent-goals', 'documents'],
  summary: 'List marketing goal documents',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/agent-goals/{goalId}/documents' },
  commandClass: 'read',
  args: [GOAL_ID_ARG],
  flags: [
    { flag: '--limit <n>', summary: 'Page size, 1-25 (default 25)' },
    CURSOR_FLAG,
    ALL_FLAG,
  ],
  examples: ['brew-cli agent-goals documents goal_123 --all'],
  run: (invocation) =>
    readGoalPage<Row>(
      invocation,
      `${goalPath(invocation.args.goalId ?? '')}/documents`
    ),
})
