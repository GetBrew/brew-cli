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

type Input =
  operations['createAgentGoal']['requestBody']['content']['application/json']
type Result =
  operations['createAgentGoal']['responses'][201]['content']['application/json']

export const agentGoalsCreateCommand = defineCommand({
  path: ['agent-goals', 'create'],
  summary:
    'Create a marketing goal; live execution requires a standing permission',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/agent-goals' },
  commandClass: 'write',
  flags: [
    { flag: '--name <name>', summary: 'Goal name' },
    { flag: '--objective <objective>', summary: 'Marketing objective' },
    { flag: '--audience-id <audienceId>', summary: 'Saved audience id' },
    { flag: '--success-metric <metric>', summary: 'Outcome to measure' },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: ['brew-cli agent-goals create --input - < goal.json'],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = asSdkInput<Input>(
      mergeInput(base, {
        name: flagString(flags.name),
        objective: flagString(flags.objective),
        audienceId: flagString(flags.audienceId),
        successMetric: flagString(flags.successMetric),
      })
    )
    return {
      data: await rawRequest<Result>(ctx, {
        method: 'POST',
        path: '/v1/agent-goals',
        body: input,
        idempotencyKey: flagString(flags.idempotencyKey),
      }),
    }
  },
})
