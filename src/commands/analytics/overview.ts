import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { flagString } from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type AnalyticsOverviewResponse =
  components['schemas']['AnalyticsOverviewResponse']

export const analyticsOverviewCommand = defineCommand({
  path: ['analytics', 'overview'],
  summary: 'Brand overview: totals, rates, timeseries (default last 7 days)',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/analytics/overview' },
  commandClass: 'read',
  flags: [
    {
      flag: '--since <datetime>',
      summary: 'Window start (ISO-8601, default 7 days ago)',
    },
    {
      flag: '--until <datetime>',
      summary: 'Window end (ISO-8601, default now)',
    },
    {
      flag: '--source <sources>',
      summary:
        'CSV of send sources: audience, api, automation_manual, automation_integration, automation_custom',
    },
    {
      flag: '--automation-id <ids>',
      summary: 'CSV of automation ids (max 20)',
    },
    { flag: '--email-id <emailId>', summary: 'Scope to one email design' },
    { flag: '--audience-id <ids>', summary: 'CSV of audience ids (max 20)' },
    {
      flag: '--trigger-event-id <ids>',
      summary: 'CSV of integration trigger-event ids (max 10)',
    },
    { flag: '--domain <domain>', summary: 'Sending domain (fromEmail match)' },
    {
      flag: '--recipient <rules>',
      summary:
        'CSV of recipient rules: full address, @domain, substring; prefix ! to exclude',
    },
  ],
  examples: [
    'brew-cli analytics overview',
    'brew-cli analytics overview --since 2026-08-01T00:00:00Z --source audience --json',
  ],
  run: async ({ ctx, flags }) => ({
    data: await rawRequest<AnalyticsOverviewResponse>(ctx, {
      method: 'GET',
      path: '/v1/analytics/overview',
      query: {
        from: flagString(flags.since),
        to: flagString(flags.until),
        source: flagString(flags.source),
        automationId: flagString(flags.automationId),
        emailId: flagString(flags.emailId),
        audienceId: flagString(flags.audienceId),
        triggerEventId: flagString(flags.triggerEventId),
        domain: flagString(flags.domain),
        recipient: flagString(flags.recipient),
      },
    }),
  }),
})
