import type { ChatSummary, ListChatsInput } from '@brew.new/sdk'
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
 * The brand's Brew chats, most recently active first, as the app's chat list
 * shows them: no transcript and no participants. `chats get <chatId>` reads
 * one chat's artifacts and transcript tail.
 */
export const chatsListCommand = defineCommand({
  path: ['chats', 'list'],
  summary:
    "List the brand's Brew chats, most recently active first; `chats get` reads one",
  sdkMethod: 'chats.list',
  route: { method: 'GET', path: '/v1/chats' },
  commandClass: 'read',
  flags: [LIMIT_FLAG, CURSOR_FLAG, ALL_FLAG],
  examples: [
    'brew-cli chats list --limit 10',
    'brew-cli chats list --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const input = {
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    }
    const chats = ctx.client().chats
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        chats.list(
          asSdkInput<ListChatsInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderChats(rows),
      }
    }
    const page = await chats.list(asSdkInput<ListChatsInput>(input))
    return { data: page, human: renderChats(page.data) }
  },
})

const TITLE_WIDTH = 60

function renderChats(rows: ReadonlyArray<ChatSummary>): string {
  if (rows.length === 0) {
    return 'No chats found.'
  }
  return renderTable(
    rows.map((row) => ({
      chatId: row.chatId,
      title: clip(row.title ?? row.firstUserPrompt ?? ''),
      status: row.status,
      origin: row.origin ?? 'web',
      updatedAt: row.updatedAt,
    })),
    [
      { key: 'chatId', header: 'CHAT' },
      { key: 'title', header: 'TITLE' },
      { key: 'status', header: 'STATUS' },
      { key: 'origin', header: 'ORIGIN' },
      { key: 'updatedAt', header: 'UPDATED' },
    ]
  )
}

/** One line per chat: an untitled chat shows its opening prompt instead. */
function clip(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length <= TITLE_WIDTH
    ? line
    : `${line.slice(0, TITLE_WIDTH - 1)}…`
}
