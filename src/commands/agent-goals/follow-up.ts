import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import {
  asSdkInput,
  flagInt,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'
import { GOAL_ID_ARG, goalPath } from './shared'

type Input =
  operations['scheduleAgentGoalFollowUp']['requestBody']['content']['application/json']
type Result =
  operations['scheduleAgentGoalFollowUp']['responses'][201]['content']['application/json']

export const agentGoalsFollowUpCommand = defineCommand({
  path: ['agent-goals', 'follow-up'],
  summary: 'Schedule a follow-up within a marketing goal',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/agent-goals/{goalId}/follow-ups' },
  commandClass: 'write',
  args: [GOAL_ID_ARG],
  flags: [
    { flag: '--message <message>', summary: 'Work to revisit' },
    {
      flag: '--source-id <sourceId>',
      summary: 'Stable occurrence identity for deduplication',
    },
    { flag: '--due-at <milliseconds>', summary: 'UTC epoch milliseconds' },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli agent-goals follow-up goal_123 --message "Review campaign results" --source-id send_123:review --due-at 1793404800000',
  ],
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = asSdkInput<Input>(
      mergeInput(base, {
        message: flagString(flags.message),
        sourceId: flagString(flags.sourceId),
        dueAt: flagInt(flags.dueAt, '--due-at'),
      })
    )
    return {
      data: await rawRequest<Result>(ctx, {
        method: 'POST',
        path: `${goalPath(args.goalId ?? '')}/follow-ups`,
        body: input,
        idempotencyKey: flagString(flags.idempotencyKey),
      }),
    }
  },
})
