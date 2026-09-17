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

export const contactsListCommand = defineCommand({
  path: ['contacts', 'list'],
  summary:
    'List contacts, newest first — free-text search and one audience; typed clauses are `contacts search`',
  sdkMethod: 'contacts.list',
  route: { method: 'GET', path: '/v1/contacts' },
  commandClass: 'read',
  flags: [
    { flag: '--search <text>', summary: 'Free-text search' },
    {
      flag: '--audience <audienceId>',
      summary: 'Only members of this saved audience',
    },
    {
      flag: '--sort <field>',
      summary: 'Any core column or custom field (default createdAt)',
    },
    { flag: '--order <order>', summary: 'Sort order: asc | desc' },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli contacts list --limit 20',
    'brew-cli contacts list --audience aud_3k9sQ --all --json',
    'brew-cli contacts list --search acme --sort email --order asc',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      search: flagString(flags.search),
      audienceId: flagString(flags.audience),
      sort: flagString(flags.sort),
      order: flagString(flags.order),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const contacts = ctx.client().contacts
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        contacts.list(
          asSdkInput<Record<string, unknown>>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderContacts(rows),
      }
    }
    const result = await contacts.list(
      asSdkInput<Record<string, unknown>>(input)
    )
    return { data: result, human: renderContacts(result.data) }
  },
})

function renderContacts(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No contacts found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'email', header: 'EMAIL' },
    { key: 'firstName', header: 'FIRST' },
    { key: 'lastName', header: 'LAST' },
    { key: 'subscribed', header: 'SUBSCRIBED' },
  ])
}
