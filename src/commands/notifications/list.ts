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

/**
 * The brand's notifications, newest first, as the app's bell shows them.
 * Each row is shown only when the key may read its feature: `emails` for chats
 * and previews, `sends` for sends (`emails` implies it), `domains` for domain
 * checks (`emails` implies it), `contacts` for imports and validations,
 * `automations` for pause windows; brand extraction and image imports reach
 * every key, `api_key_created` needs the `all` scope, `send_limit_reached`
 * reaches organization admins only, and a comment mention or reply never
 * reaches an API key. So an empty page can mean this key cannot see that
 * kind of row. Reading marks nothing read.
 */
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
      const rows = await collectAll(ctx, (cursor) =>
        notifications.list(
          asSdkInput<ListNotificationsInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
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

/**
 * The API scans a bounded window per page, so a page can hold fewer rows than
 * `--limit` (even none) while more follow: the next cursor is printed
 * whenever there is one, so a short page never reads as the end.
 */
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
