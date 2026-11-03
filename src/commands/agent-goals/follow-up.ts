import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import {
  asSdkInput,
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
    {
      flag: '--due-at <timestamp>',
      summary: 'ISO 8601 timestamp with a timezone',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli agent-goals follow-up goal_123 --message "Review campaign results" --source-id send_123:review --due-at 2027-01-01T00:00:00.000Z',
  ],
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = asSdkInput<Input>(
      mergeInput(base, {
        message: flagString(flags.message),
        sourceId: flagString(flags.sourceId),
        dueAt: flagString(flags.dueAt),
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
