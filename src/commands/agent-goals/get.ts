import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { rawRequest } from '../../lib/raw-request'
import { GOAL_ID_ARG, goalPath } from './shared'

type Result =
  operations['getAgentGoal']['responses'][200]['content']['application/json']

export const agentGoalsGetCommand = defineCommand({
  path: ['agent-goals', 'get'],
  summary: 'Read a marketing goal, tasks, permissions and workspace',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/agent-goals/{goalId}' },
  commandClass: 'read',
  args: [GOAL_ID_ARG],
  examples: ['brew-cli agent-goals get goal_123'],
  run: async ({ ctx, args }) => ({
    data: await rawRequest<Result>(ctx, {
      method: 'GET',
      path: goalPath(args.goalId ?? ''),
    }),
  }),
})
