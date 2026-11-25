import type { EnsureIntegrationEventTriggerInput } from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import {
  asSdkInput,
  flagNonEmptyString,
  IDEMPOTENCY_FLAG,
  requestOptions,
} from '../../../lib/input'

export const automationsTriggersEnsureIntegrationEventCommand = defineCommand({
  path: ['automations', 'triggers', 'ensure-integration-event'],
  summary:
    'Get or create the trigger for one live integration event (an eventId from `integrations events list`)',
  sdkMethod: 'automations.triggers.ensureIntegrationEvent',
  route: {
    method: 'POST',
    path: '/v1/automations/triggers/integration-events',
  },
  commandClass: 'write',
  flags: [
    {
      flag: '--event-id <eventId>',
      summary:
        'The live event, from `integrations events list` (never composed from a provider and an event name)',
    },
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli automations triggers ensure-integration-event --event-id k5714pq3vm8x2n6c9d0b7f1h4j6g2r8t',
  ],
  run: async ({ ctx, flags }) => {
    const eventId = flagNonEmptyString(flags.eventId, '--event-id')
    if (eventId === undefined) {
      throw new CliUsageError(
        '--event-id is required (ids from brew-cli integrations events list).'
      )
    }
    const result = await ctx
      .client()
      .automations.triggers.ensureIntegrationEvent(
        asSdkInput<EnsureIntegrationEventTriggerInput>({ eventId }),
        requestOptions(flags)
      )
    return { data: result }
  },
})
