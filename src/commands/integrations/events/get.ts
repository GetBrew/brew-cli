import { defineCommand } from '../../../lib/define-command'

/**
 * One live integration event in full: each property with its template
 * `variable` (`{{ <variable> | fallback }}` in an email), which hold
 * personal data, which Brew suggests for personalization, its lifecycle
 * stage and its roles in the product model. Another brand's id is the same
 * `404 INTEGRATION_EVENT_NOT_FOUND` as an unknown one.
 *
 * Brew may describe the event at the provider first, on the account's read
 * budget; `propertiesStatus` (and `retryAfterSeconds` when `rate_limited`)
 * says how current the properties are. The row prints as the API sent it,
 * pretty-printed on a terminal, so the status shows there too.
 */
export const integrationsEventsGetCommand = defineCommand({
  path: ['integrations', 'events', 'get'],
  summary:
    'Fetch one live integration event in full: each property with its template variable and whether it is personal data, plus propertiesStatus (how current they are). Needs the automations scope',
  sdkMethod: 'integrations.events.get',
  route: { method: 'GET', path: '/v1/integrations/events/{eventId}' },
  commandClass: 'read',
  args: [
    {
      name: 'eventId',
      summary: 'The eventId an `integrations events list` row carries',
      isRequired: true,
    },
  ],
  examples: [
    'brew-cli integrations events get k5714pq3vm8x2n6c9d0b7f1h4j6g2r8t',
    'brew-cli integrations events get k5714pq3vm8x2n6c9d0b7f1h4j6g2r8t --json | jq .properties',
  ],
  run: async ({ ctx, args }) => ({
    data: await ctx.client().integrations.events.get(args.eventId ?? ''),
  }),
})
