import type { components } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { flagString } from '../../../lib/input'
import { rawRequest } from '../../../lib/raw-request'

type CancelRequest = components['schemas']['AutomationRunCancelRequest']
type CancelResponse = components['schemas']['AutomationRunCancelResponse']

/**
 * Operator cancel of ONE run of an event-triggered automation (or a test
 * run), by `automationRunId` — the same flat identity `runs list` uses.
 * `status: 'canceled'` is the only PATCH action the API has, so the command
 * fills it in. Manual-audience launches are controlled with
 * `automations audience-runs control` instead.
 *
 * Raw transport until `@brew.new/sdk` ships `automations.runs.cancel`.
 */
export const automationsRunsCancelCommand = defineCommand({
  path: ['automations', 'runs', 'cancel'],
  summary:
    'Cancel one in-flight automation run (event execution or test run) — nothing further is sent, and it can never be resumed',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'PATCH', path: '/v1/automations/runs' },
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
  ],
  examples: [
    'brew-cli automations runs cancel run_9f2kX --reason "wrong audience" --yes',
  ],
  confirmSummary: ({ args }) =>
    `Cancel automation run ${args.automationRunId ?? ''}. Nothing further is sent; emails already delivered are not recalled, and a canceled run can never be resumed.`,
  run: async ({ ctx, args, flags }) => {
    const reason = flagString(flags.reason)
    const body: CancelRequest = {
      automationRunId: args.automationRunId ?? '',
      status: 'canceled',
      ...(reason === undefined ? {} : { reason }),
    }
    const data = await rawRequest<CancelResponse>(ctx, {
      method: 'PATCH',
      path: '/v1/automations/runs',
      body,
    })
    return { data }
  },
})
