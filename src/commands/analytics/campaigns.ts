import type { CampaignAnalyticsInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import {
  asSdkInput,
  flagInt,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'
import { renderTable } from '../../lib/output'
import {
  ALL_FLAG,
  CURSOR_FLAG,
  collectAll,
  LIMIT_FLAG,
} from '../../lib/paginate'

export const analyticsCampaignsCommand = defineCommand({
  path: ['analytics', 'campaigns'],
  summary: 'Lifetime per-campaign KPIs (sent, opened, clicked, bounced)',
  sdkMethod: 'analytics.campaigns',
  route: { method: 'GET', path: '/v1/analytics/campaigns' },
  commandClass: 'read',
  flags: [LIMIT_FLAG, CURSOR_FLAG, ALL_FLAG, INPUT_FLAG],
  examples: [
    'brew-cli analytics campaigns',
    'brew-cli analytics campaigns --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const analytics = ctx.client().analytics
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        analytics.campaigns(
          asSdkInput<CampaignAnalyticsInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderCampaigns(rows),
      }
    }
    const result = await analytics.campaigns(
      asSdkInput<CampaignAnalyticsInput>(input)
    )
    return { data: result, human: renderCampaigns(result.data) }
  },
})

function renderCampaigns(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No campaign analytics rows.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'sendId', header: 'SEND' },
    { key: 'title', header: 'TITLE' },
    { key: 'status', header: 'STATUS' },
    { key: 'sentAt', header: 'SENT AT' },
  ])
}
