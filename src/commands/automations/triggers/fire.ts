import type { FireTriggerInput } from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import {
  asSdkInput,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  readJsonFlag,
  requestOptions,
} from '../../../lib/input'

export const automationsTriggersFireCommand = defineCommand({
  path: ['automations', 'triggers', 'fire'],
  summary: 'Fire a trigger event with a payload (starts LIVE runs)',
  sdkMethod: 'automations.triggers.fire',
  route: {
    method: 'POST',
    path: '/v1/automations/triggers/{triggerEventId}/fire',
  },
  commandClass: 'destructive',
  args: [
    {
      name: 'triggerEventId',
      summary: 'Id of the trigger event to fire',
      isRequired: true,
    },
  ],
  flags: [INPUT_FLAG, IDEMPOTENCY_FLAG],
  examples: [
    `brew-cli automations triggers fire tev_123 --input '{"payload":{"userId":"u_1"}}' --yes`,
  ],
  confirmSummary: ({ args }) =>
    `Fire trigger ${args.triggerEventId ?? ''} — starts REAL runs on every published automation listening to it.`,
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    if (base === undefined) {
      throw new CliUsageError('--input is required — the trigger payload JSON.')
    }
    // A bare object is sugar for the { payload } envelope the API takes.
    const body =
      typeof base === 'object' && base !== null && 'payload' in base
        ? (base as Record<string, unknown>)
        : { payload: base }
    const result = await ctx.client().automations.triggers.fire(
      asSdkInput<FireTriggerInput>({
        ...body,
        triggerEventId: args.triggerEventId ?? '',
      }),
      requestOptions(flags)
    )
    return { data: result }
  },
})
