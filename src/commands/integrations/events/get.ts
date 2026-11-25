import { defineCommand } from '../../../lib/define-command'

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
