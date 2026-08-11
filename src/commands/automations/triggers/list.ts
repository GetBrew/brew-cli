import type { ListTriggersInput } from '@brew.new/sdk'
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

export const automationsTriggersListCommand = defineCommand({
  path: ['automations', 'triggers', 'list'],
  summary: 'List trigger events (their payload schemas drive fires)',
  sdkMethod: 'automations.triggers.list',
  route: { method: 'GET', path: '/v1/automations/triggers' },
  commandClass: 'read',
  flags: [
    {
      flag: '--trigger <triggerEventId>',
      summary: 'Fetch one trigger event (single-row page)',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli automations triggers list',
    'brew-cli automations triggers list --trigger tev_123',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      triggerEventId: flagString(flags.trigger),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const triggers = ctx.client().automations.triggers
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        triggers.list(
          asSdkInput<ListTriggersInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderTriggers(rows),
      }
    }
    const result = await triggers.list(asSdkInput<ListTriggersInput>(input))
    return { data: result, human: renderTriggers(result.data) }
  },
})

function renderTriggers(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No trigger events found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'triggerEventId', header: 'TRIGGER' },
    { key: 'title', header: 'TITLE' },
    { key: 'provider', header: 'PROVIDER' },
  ])
}
