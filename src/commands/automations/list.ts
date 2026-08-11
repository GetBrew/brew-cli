import type { ListAutomationsInput } from '@brew.new/sdk'
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

export const automationsListCommand = defineCommand({
  path: ['automations', 'list'],
  summary: 'List automations (lean rows; `automations get` for the graph)',
  sdkMethod: 'automations.list',
  route: { method: 'GET', path: '/v1/automations' },
  commandClass: 'read',
  flags: [LIMIT_FLAG, CURSOR_FLAG, ALL_FLAG, INPUT_FLAG],
  examples: [
    'brew-cli automations list',
    'brew-cli automations list --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const automations = ctx.client().automations
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        automations.list(
          asSdkInput<ListAutomationsInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderAutomations(rows),
      }
    }
    const result = await automations.list(
      asSdkInput<ListAutomationsInput>(input)
    )
    return { data: result, human: renderAutomations(result.data) }
  },
})

function renderAutomations(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No automations found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'automationId', header: 'AUTOMATION' },
    { key: 'name', header: 'NAME' },
    { key: 'published', header: 'PUBLISHED' },
    { key: 'version', header: 'VERSION' },
    { key: 'triggerEventId', header: 'TRIGGER' },
  ])
}
