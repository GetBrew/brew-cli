import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type Input = components['schemas']['ProductAnalyticsTrackRequest']
type Response = components['schemas']['ProductAnalyticsTrackResponse']

export const analyticsTrackCommand = defineCommand({
  path: ['analytics', 'track'],
  summary:
    'Submit trusted product events; matching rules can start LIVE flows (automations scope)',
  // Switch to analytics.track when that SDK method is released.
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/analytics/track' },
  commandClass: 'destructive',
  flags: [
    {
      flag: '--project-id <id>',
      summary: 'Analytics project in the selected brand',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli analytics track --project-id pap_project --input - --idempotency-key order-123 --yes < events.json',
  ],
  confirmSummary: () =>
    'Submit trusted analytics events — matching published rules can start REAL flows. Keep event IDs stable when retrying.',
  run: async ({ ctx, flags }) => {
    const input = mergeInput(await readJsonFlag(ctx, flags.input, '--input'), {
      projectId: flagString(flags.projectId),
    })
    if (typeof input.projectId !== 'string' || !input.projectId) {
      throw new CliUsageError(
        '--project-id or projectId in --input is required.'
      )
    }
    if (!Array.isArray(input.events) || input.events.length === 0) {
      throw new CliUsageError(
        '--input must contain a non-empty events array using the product analytics event contract.'
      )
    }
    return {
      data: await rawRequest<Response>(ctx, {
        method: 'POST',
        path: '/v1/analytics/track',
        body: asSdkInput<Input>(input),
        idempotencyKey: flagString(flags.idempotencyKey),
      }),
    }
  },
})
