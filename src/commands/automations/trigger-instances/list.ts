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
import type { CliContext } from '../../../lib/types'

/**
 * `state` on every row, in lifecycle order:
 * `received | verified | matched | partially_fired | fired | rejected |
 * dead_letter`. Branch on it — `fired` means every matched automation
 * started, `partially_fired` means some starts are still being retried,
 * and `rejected` carries a `rejectionReason`.
 */
export const automationsTriggerInstancesListCommand = defineCommand({
  path: ['automations', 'trigger-instances', 'list'],
  summary:
    'List fired-trigger instances (the inbound-fire audit log); each row carries a lifecycle `state`',
  sdkMethod: 'automations.triggerInstances.list',
  route: { method: 'GET', path: '/v1/automations/trigger-instances' },
  commandClass: 'read',
  flags: [
    {
      flag: '--trigger <triggerEventId>',
      summary: 'Filter by trigger event',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli automations trigger-instances list --trigger tri_signup',
    'brew-cli automations trigger-instances list --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      triggerEventId: flagString(flags.trigger),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    return await listTriggerInstances(ctx, input, flags.all === true)
  },
})

/**
 * The shared read behind `automations trigger-instances list` and the
 * `analytics trigger-instances list` alias.
 */
export async function listTriggerInstances(
  ctx: CliContext,
  input: Record<string, unknown>,
  followCursor: boolean
): Promise<{ data: unknown; human: string }> {
  const triggerInstances = ctx.client().automations.triggerInstances
  if (followCursor) {
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
}

export function renderInstances(rows: ReadonlyArray<unknown>): string {
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
