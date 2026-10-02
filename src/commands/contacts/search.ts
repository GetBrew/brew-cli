import type { SearchContactsInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import {
  asSdkInput,
  flagInt,
  flagString,
  INPUT_FLAG,
  mergeInput,
  parseFilterFlags,
  readJsonFlag,
} from '../../lib/input'
import { renderTable } from '../../lib/output'
import {
  ALL_FLAG,
  CURSOR_FLAG,
  collectAll,
  LIMIT_FLAG,
} from '../../lib/paginate'

export const contactsSearchCommand = defineCommand({
  path: ['contacts', 'search'],
  summary: 'Search contacts with structured filters (the contacts read)',
  sdkMethod: 'contacts.search',
  route: { method: 'POST', path: '/v1/contacts/search' },
  commandClass: 'read',
  flags: [
    { flag: '--search <text>', summary: 'Free-text search' },
    {
      flag: '--filter <filters...>',
      summary: 'Structured filter field:operator[:value], repeatable',
    },
    { flag: '--audience <audienceId>', summary: 'Scope to one audience' },
    { flag: '--logic <logic>', summary: 'Filter combinator: and | or' },
    { flag: '--sort <field>', summary: 'Sort field' },
    { flag: '--order <order>', summary: 'Sort order: asc | desc' },
    {
      flag: '--include <tokens>',
      summary:
        "Comma-separated expansions: openProfile (each row's smart-send open-time profile; a page then holds at most 10 rows; needs the emails scope too)",
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli contacts search --filter email:equals:jane@example.com',
    'brew-cli contacts search --search jane --limit 10',
    'brew-cli contacts search --all --json',
    'brew-cli contacts search --audience aud_123 --include openProfile --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      search: flagString(flags.search),
      filters: parseFilterFlags(flags.filter),
      audienceId: flagString(flags.audience),
      logic: flagString(flags.logic),
      sort: flagString(flags.sort),
      order: flagString(flags.order),
      include: includeTokens(flags.include),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const contacts = ctx.client().contacts
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        contacts.search(
          asSdkInput<SearchContactsInput>({
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
    const result = await contacts.search(asSdkInput<SearchContactsInput>(input))
    return { data: result, human: renderContacts(result.data) }
  },
})

/** The body takes `include` as an array; the flag is comma-separated. */
function includeTokens(value: unknown): readonly string[] | undefined {
  const tokens = (flagString(value) ?? '')
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
  return tokens.length === 0 ? undefined : tokens
}

type OpenProfile = {
  readonly totalOpens?: number
  readonly bestSendMinuteUtc?: number
}

function renderContacts(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No contacts matched.'
  }
  const contacts = rows as ReadonlyArray<Record<string, unknown>>
  const columns = [
    { key: 'email', header: 'EMAIL' },
    { key: 'firstName', header: 'FIRST' },
    { key: 'lastName', header: 'LAST' },
    { key: 'subscribed', header: 'SUBSCRIBED' },
  ]
  if (!contacts.some((row) => 'openProfile' in row)) {
    return renderTable(contacts, columns)
  }
  // `--include openProfile`: null until the contact's opens are folded in.
  return renderTable(
    contacts.map((row) => {
      const profile = (row.openProfile ?? null) as OpenProfile | null
      return {
        ...row,
        opens: profile?.totalOpens,
        bestSend: utcClock(profile?.bestSendMinuteUtc),
      }
    }),
    [
      ...columns,
      { key: 'opens', header: 'OPENS' },
      { key: 'bestSend', header: 'BEST SEND (UTC)' },
    ]
  )
}

/** Minute of the UTC day as HH:MM. */
function utcClock(minute: number | undefined): string | undefined {
  if (minute === undefined) {
    return undefined
  }
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`
}
