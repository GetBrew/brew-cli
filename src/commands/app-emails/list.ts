import type { AppEmail, ListAppEmailsInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { asSdkInput, flagInt, flagString } from '../../lib/input'
import { renderTable } from '../../lib/output'
import {
  ALL_FLAG,
  CURSOR_FLAG,
  collectAll,
  LIMIT_FLAG,
} from '../../lib/paginate'

export const appEmailsListCommand = defineCommand({
  path: ['app-emails', 'list'],
  summary:
    'List the app emails your code sends by key, with sender and readiness',
  sdkMethod: 'appEmails.list',
  route: { method: 'GET', path: '/v1/app-emails' },
  commandClass: 'read',
  flags: [LIMIT_FLAG, CURSOR_FLAG, ALL_FLAG],
  examples: [
    'brew-cli app-emails list',
    'brew-cli app-emails list --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const limit = flagInt(flags.limit, '--limit')
    const cursor = flagString(flags.cursor)
    const input = {
      ...(limit === undefined ? {} : { limit }),
      ...(cursor === undefined ? {} : { cursor }),
    }
    const appEmails = ctx.client().appEmails
    if (flags.all === true) {
      const rows = await collectAll(
        ctx,
        (next) =>
          appEmails.list(
            asSdkInput<ListAppEmailsInput>({
              ...input,
              ...(next === undefined ? {} : { cursor: next }),
            })
          ),
        { cursor }
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderAppEmails(rows),
      }
    }
    const result = await appEmails.list(asSdkInput<ListAppEmailsInput>(input))
    return { data: result, human: renderAppEmails(result.data) }
  },
})

export function renderAppEmails(rows: ReadonlyArray<AppEmail>): string {
  if (rows.length === 0) {
    return 'No app emails set up yet. Run `app-emails kit` or `app-emails upsert <key>`.'
  }
  return renderTable(
    rows.map((row) => ({
      triggerKey: row.triggerKey,
      title: row.title,
      published: row.published ? 'yes' : 'no',
      sender: row.sender.mode,
      ready: row.readiness.ready
        ? row.readiness.teamOnly
          ? 'team only'
          : 'yes'
        : row.readiness.blockers.join(', '),
    })),
    [
      { key: 'triggerKey', header: 'KEY' },
      { key: 'title', header: 'TITLE' },
      { key: 'published', header: 'PUBLISHED' },
      { key: 'sender', header: 'SENDER' },
      { key: 'ready', header: 'READY' },
    ]
  )
}
