import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import { flagString } from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'
import { GOAL_ID_ARG, goalPath } from './shared'

type Result =
  operations['updateAgentGoal']['responses'][200]['content']['application/json']

export const agentGoalsUpdateCommand = defineCommand({
  path: ['agent-goals', 'update'],
  summary: 'Pause, resume or cancel a marketing goal',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'PATCH', path: '/v1/agent-goals/{goalId}' },
  commandClass: 'destructive',
  args: [GOAL_ID_ARG],
  flags: [
    { flag: '--status <status>', summary: 'active, paused or cancelled' },
  ],
  examples: ['brew-cli agent-goals update goal_123 --status paused --yes'],
  prepareInput: async ({ flags }) => {
    const status = flagString(flags.status)
    if (status !== 'active' && status !== 'paused' && status !== 'cancelled') {
      throw new CliUsageError('--status must be active, paused or cancelled.')
    }
    return { status }
  },
  confirmSummary: ({ args, input }) =>
    input?.status === 'paused'
      ? undefined
      : `Set goal ${args.goalId ?? ''} to ${String(input?.status ?? '')}. This changes its scheduled work.`,
  run: async ({ ctx, args, input }) => {
    if (!input) throw new CliUsageError('Goal update input was not prepared.')
    return {
      data: await rawRequest<Result>(ctx, {
        method: 'PATCH',
        path: goalPath(args.goalId ?? ''),
        body: input,
      }),
    }
  },
})
