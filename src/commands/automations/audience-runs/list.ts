import type { ListAudienceRunsInput } from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import { asSdkInput, flagInt, flagString } from '../../../lib/input'

export const automationsAudienceRunsListCommand = defineCommand({
  path: ['automations', 'audience-runs', 'list'],
  summary: 'List manual-audience runs (newest first)',
  sdkMethod: 'automations.audienceRuns.list',
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
      data: await ctx.client().automations.audienceRuns.list(
        asSdkInput<ListAudienceRunsInput>({
          audienceRunId: flagString(flags.audienceRunId),
          automationId: flagString(flags.automationId),
          limit,
        })
      ),
    }
  },
})
