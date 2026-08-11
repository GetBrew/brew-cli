import type { ListTriggerInstancesInput } from '@brew.new/sdk'
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

export const analyticsTriggerInstancesListCommand = defineCommand({
  path: ['analytics', 'trigger-instances', 'list'],
  summary: 'List fired-trigger instances (ingest + match history)',
  sdkMethod: 'analytics.triggerInstances.list',
  route: { method: 'GET', path: '/v1/analytics/trigger-instances' },
  commandClass: 'read',
  flags: [
    {
      flag: '--trigger <triggerEventId>',
      summary: 'Filter by trigger event',
    },
    {
      flag: '--trigger-instance <triggerInstanceId>',
      summary: 'Fetch one instance (single-row page)',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli analytics trigger-instances list --trigger tev_123',
    'brew-cli analytics trigger-instances list --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      triggerEventId: flagString(flags.trigger),
      triggerInstanceId: flagString(flags.triggerInstance),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const triggerInstances = ctx.client().analytics.triggerInstances
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        triggerInstances.list(
          asSdkInput<ListTriggerInstancesInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderInstances(rows),
      }
    }
    const result = await triggerInstances.list(
      asSdkInput<ListTriggerInstancesInput>(input)
    )
    return { data: result, human: renderInstances(result.data) }
  },
})

function renderInstances(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No trigger instances found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'triggerInstanceId', header: 'INSTANCE' },
    { key: 'source', header: 'SOURCE' },
    { key: 'state', header: 'STATE' },
    { key: 'receivedAt', header: 'RECEIVED' },
  ])
}
