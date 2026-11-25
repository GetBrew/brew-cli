import type { ListNotificationsInput, NotificationRow } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { asSdkInput, flagInt, flagString } from '../../lib/input'
import { renderTable } from '../../lib/output'
import {
  ALL_FLAG,
  CURSOR_FLAG,
  collectAll,
  LIMIT_FLAG,
} from '../../lib/paginate'

export const notificationsListCommand = defineCommand({
  path: ['notifications', 'list'],
  summary:
    "List the brand's notifications (generations, sends, imports, domain checks), newest first",
  sdkMethod: 'notifications.list',
  route: { method: 'GET', path: '/v1/notifications' },
  commandClass: 'read',
  flags: [
    {
      flag: '--type <type>',
      summary:
        'Only this notification type (e.g. email_sent, email_send_failed, import_job, domain_score_run); a type this key cannot see is an empty page, not an error',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
  ],
  examples: [
    'brew-cli notifications list',
    'brew-cli notifications list --type email_send_failed --json',
    'brew-cli notifications list --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const input = {
      type: flagString(flags.type),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    }
    const notifications = ctx.client().notifications
    if (flags.all === true) {
      const rows = await collectAll(
        ctx,
        (cursor) =>
          notifications.list(
            asSdkInput<ListNotificationsInput>({
              ...input,
              ...(cursor === undefined ? {} : { cursor }),
            })
          ),
        { cursor: flagString(input.cursor) }
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderNotifications(rows, null),
      }
    }
    const page = await notifications.list(
      asSdkInput<ListNotificationsInput>(input)
    )
    return {
      data: page,
      human: renderNotifications(
        page.data,
        page.pagination.hasMore ? page.pagination.cursor : null
      ),
    }
  },
})

function renderNotifications(
  rows: ReadonlyArray<NotificationRow>,
  nextCursor: string | null
): string {
  const more =
    nextCursor === null ? undefined : `More follow: --cursor ${nextCursor}`
  if (rows.length === 0) {
    return more === undefined
      ? 'No notifications this key can see.'
      : `No notifications on this page. ${more}`
  }
  const table = renderTable(
    rows.map((row) => ({ ...row })),
    [
      { key: 'notificationId', header: 'NOTIFICATION' },
      { key: 'type', header: 'TYPE' },
      { key: 'status', header: 'STATUS' },
      { key: 'title', header: 'TITLE' },
      { key: 'createdAt', header: 'CREATED' },
    ]
  )
  return more === undefined ? table : `${table}\n${more}`
}
