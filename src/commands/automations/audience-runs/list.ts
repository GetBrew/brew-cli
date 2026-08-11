import type { components } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { flagInt, flagString } from '../../../lib/input'
import { rawRequest } from '../../../lib/raw-request'

type AudienceRunsListResponse =
  components['schemas']['AudienceRunsListResponse']

export const automationsAudienceRunsListCommand = defineCommand({
  path: ['automations', 'audience-runs', 'list'],
  summary: 'List manual-audience runs (newest first)',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/automations/audience-runs' },
  commandClass: 'read',
  // The spec paginates by --limit only: no cursor, and the response carries
  // no pagination envelope, so there is no --all here.
  flags: [
    {
      flag: '--audience-run-id <id>',
      summary: 'Fetch a single audience run by id',
    },
    {
      flag: '--automation-id <id>',
      summary: 'Filter runs to a single automation',
    },
    { flag: '--limit <n>', summary: 'Max rows, 1-200 (default 50)' },
  ],
  examples: [
    'brew-cli automations audience-runs list',
    'brew-cli automations audience-runs list --automation-id auto_abc --limit 20',
  ],
  run: async ({ ctx, flags }) => {
    const limit = flagInt(flags.limit, '--limit')
    return {
      data: await rawRequest<AudienceRunsListResponse>(ctx, {
        method: 'GET',
        path: '/v1/automations/audience-runs',
        query: {
          audienceRunId: flagString(flags.audienceRunId),
          automationId: flagString(flags.automationId),
          limit: limit === undefined ? undefined : String(limit),
        },
      }),
    }
  },
})
