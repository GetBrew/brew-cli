import type { AutomationAnalyticsInput } from '@brew.new/sdk'
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
import { LIMIT_FLAG } from '../../lib/paginate'

export const analyticsAutomationsCommand = defineCommand({
  path: ['analytics', 'automations'],
  summary: 'Windowed per-automation performance + totals',
  sdkMethod: 'analytics.automations',
  route: { method: 'GET', path: '/v1/analytics/automations' },
  commandClass: 'read',
  flags: [
    { flag: '--since <datetime>', summary: 'Window start (ISO-8601)' },
    { flag: '--until <datetime>', summary: 'Window end (ISO-8601)' },
    {
      flag: '--automation <automationId>',
      summary: 'Narrow to one automation',
    },
    LIMIT_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli analytics automations',
    'brew-cli analytics automations --since 2026-07-01 --until 2026-08-01',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      from: flagString(flags.since),
      to: flagString(flags.until),
      automationId: flagString(flags.automation),
      limit: flagInt(flags.limit, '--limit'),
    })
    const result = await ctx
      .client()
      .analytics.automations(asSdkInput<AutomationAnalyticsInput>(input))
    return { data: result, human: renderAutomationRows(result.data) }
  },
})

function renderAutomationRows(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No automation analytics rows.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'automationId', header: 'AUTOMATION' },
    { key: 'name', header: 'NAME' },
    { key: 'runs', header: 'RUNS' },
    { key: 'completed', header: 'COMPLETED' },
    { key: 'failed', header: 'FAILED' },
    { key: 'openRate', header: 'OPEN RATE' },
  ])
}
