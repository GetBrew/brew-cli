import type { ListAudienceRunsInput } from '@brew.new/sdk'
import { inputField, singleRowPage } from '../../../lib/compat'
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

export const automationsAudienceRunsListCommand = defineCommand({
  path: ['automations', 'audience-runs', 'list'],
  summary:
    'List manual-audience runs, newest first; one run is `automations audience-runs get`',
  sdkMethod: 'automations.audienceRuns.list',
  route: { method: 'GET', path: '/v1/automations/audience-runs' },
  commandClass: 'read',
  flags: [
    {
      flag: '--automation <automationId>',
      summary: 'Only runs of this automation',
    },
    {
      flag: '--automation-id <automationId>',
      summary: '0.6 alias of --automation',
    },
    {
      flag: '--audience-run-id <audienceRunId>',
      summary:
        '0.6 shim: read ONE run as a single-row page (`automations audience-runs get` is the real read)',
    },
    {
      flag: '--status <status>',
      summary:
        'queued | scheduled | running | paused | completed | failed | canceled',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli automations audience-runs list',
    'brew-cli automations audience-runs list --automation am_123 --status running',
  ],
  run: async ({ ctx, flags }) => {
    const audienceRuns = ctx.client().automations.audienceRuns
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const audienceRunId =
      flagString(flags.audienceRunId) ?? inputField(base, 'audienceRunId')
    if (audienceRunId !== undefined) {
      const row = await audienceRuns.get(audienceRunId)
      return { data: singleRowPage(row), human: renderAudienceRuns([row]) }
    }
    const input = mergeInput(base, {
      automationId:
        flagString(flags.automation) ?? flagString(flags.automationId),
      status: flagString(flags.status),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        audienceRuns.list(
          asSdkInput<ListAudienceRunsInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderAudienceRuns(rows),
      }
    }
    const result = await audienceRuns.list(
      asSdkInput<ListAudienceRunsInput>(input)
    )
    return { data: result, human: renderAudienceRuns(result.data) }
  },
})

function renderAudienceRuns(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No audience runs found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'audienceRunId', header: 'AUDIENCE RUN' },
    { key: 'automationId', header: 'AUTOMATION' },
    { key: 'status', header: 'STATUS' },
    { key: 'totalRecipients', header: 'RECIPIENTS' },
  ])
}
