import type { ListAutomationRunsInput } from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import {
  asSdkInput,
  flagInt,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../../lib/input'
import { renderTable } from '../../../lib/output'
import {
  ALL_FLAG,
  CURSOR_FLAG,
  collectAll,
  LIMIT_FLAG,
} from '../../../lib/paginate'

export const automationsRunsListCommand = defineCommand({
  path: ['automations', 'runs', 'list'],
  summary:
    'List automation runs (live + test history); one run is `automations runs get`',
  sdkMethod: 'automations.runs.list',
  route: { method: 'GET', path: '/v1/automations/runs' },
  commandClass: 'read',
  flags: [
    { flag: '--automation <automationId>', summary: 'Filter by automation' },
    {
      flag: '--trigger <triggerEventId>',
      summary: 'Filter by trigger event',
    },
    {
      flag: '--trigger-instance <triggerInstanceId>',
      summary: 'Filter by fired trigger instance',
    },
    {
      flag: '--status <status>',
      summary: 'queued | running | completed | failed | canceled',
    },
    { flag: '--mode <mode>', summary: 'live | test' },
    { flag: '--since <datetime>', summary: 'Runs started at/after (ISO-8601)' },
    {
      flag: '--until <datetime>',
      summary: 'Runs started at/before (ISO-8601)',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli automations runs list --automation am_123 --status failed',
    'brew-cli automations runs list --trigger-instance tin_2f1c9d8a',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      automationId: flagString(flags.automation),
      triggerEventId: flagString(flags.trigger),
      triggerInstanceId: flagString(flags.triggerInstance),
      status: flagString(flags.status),
      mode: flagString(flags.mode),
      from: flagString(flags.since),
      to: flagString(flags.until),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const runs = ctx.client().automations.runs
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        runs.list(
          asSdkInput<ListAutomationRunsInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderRuns(rows),
      }
    }
    const result = await runs.list(asSdkInput<ListAutomationRunsInput>(input))
    return { data: result, human: renderRuns(result.data) }
  },
})

function renderRuns(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No automation runs found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'automationRunId', header: 'RUN' },
    { key: 'automationId', header: 'AUTOMATION' },
    { key: 'status', header: 'STATUS' },
    { key: 'mode', header: 'MODE' },
    { key: 'recipient', header: 'RECIPIENT' },
  ])
}
