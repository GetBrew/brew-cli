import { defineCommand } from '../../../lib/define-command'
import {
  flagString,
  IDEMPOTENCY_FLAG,
  requestOptions,
} from '../../../lib/input'

/**
 * Operator cancel of ONE run of an event-triggered automation (or a test
 * run), by `automationRunId` — the same flat identity `runs list` uses.
 * Manual-audience launches are controlled with
 * `automations audience-runs pause|resume|cancel` instead.
 */
export const automationsRunsCancelCommand = defineCommand({
  path: ['automations', 'runs', 'cancel'],
  summary:
    'Cancel one in-flight automation run (event execution or test run) — nothing further is sent, and it can never be resumed',
  sdkMethod: 'automations.runs.cancel',
  route: {
    method: 'POST',
    path: '/v1/automations/runs/{automationRunId}/cancel',
  },
  commandClass: 'destructive',
  args: [
    {
      name: 'automationRunId',
      summary:
        'Run id to cancel (from `automations runs list`, a test start, or a fire response)',
      isRequired: true,
    },
  ],
  flags: [
    { flag: '--reason <text>', summary: 'Operator note stored on the run' },
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli automations runs cancel run_9f2kX --reason "wrong audience" --yes',
  ],
  confirmSummary: ({ args }) =>
    `Cancel automation run ${args.automationRunId ?? ''}. Nothing further is sent; emails already delivered are not recalled, and a canceled run can never be resumed.`,
  run: async ({ ctx, args, flags }) => {
    const reason = flagString(flags.reason)
    const options = {
      ...requestOptions(flags),
      ...(reason === undefined ? {} : { reason }),
    }
    return {
      data: await ctx
        .client()
        .automations.runs.cancel(
          args.automationRunId ?? '',
          Object.keys(options).length === 0 ? undefined : options
        ),
    }
  },
})
