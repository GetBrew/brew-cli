import type {
  EmailCommentMessage,
  EmailCommentThread,
  ListEmailCommentsInput,
  ListEmailCommentsResponse,
} from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import {
  asSdkInput,
  flagInt,
  flagNonEmptyString,
  flagString,
} from '../../../lib/input'
import { progress, renderTable } from '../../../lib/output'
import {
  assertPaginationProgress,
  CURSOR_FLAG,
  collectAll,
} from '../../../lib/paginate'
import type { CliContext } from '../../../lib/types'

type CommentsPage = ListEmailCommentsResponse
type Thread = EmailCommentThread
type Message = EmailCommentMessage

export const emailsCommentsListCommand = defineCommand({
  path: ['emails', 'comments', 'list'],
  summary:
    "List a design's open comment threads (who, where, latest message); --include messages adds the messages",
  sdkMethod: 'emails.comments.list',
  route: { method: 'GET', path: '/v1/emails/{emailId}/comments' },
  commandClass: 'read',
  args: [
    {
      name: 'emailId',
      summary: 'Design id (from `emails list`)',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--include <tokens>',
      summary:
        "Comma-separated expansions: messages (each thread's newest messages, oldest first; at most 3 threads per page)",
    },
    {
      flag: '--comment-id <commentId>',
      summary: 'Read this one thread (cmt_…) instead of the page',
    },
    {
      flag: '--messages-cursor <cursor>',
      summary:
        "With --comment-id: the thread's messagesCursor, for its next older messages (implies --include messages)",
    },
    {
      flag: '--limit <n>',
      summary:
        'Page size, 1-100 (default 100; at most 3 with --include messages)',
    },
    CURSOR_FLAG,
    {
      flag: '--all',
      summary:
        'Follow the cursor and return every thread as one page; with --comment-id, that thread with every message',
    },
  ],
  examples: [
    'brew-cli emails comments list em_123',
    'brew-cli emails comments list em_123 --include messages --json',
    'brew-cli emails comments list em_123 --comment-id cmt_V1StGXR8Z5jdHi6BmyT2a --all --json',
  ],
  run: async ({ ctx, args, flags }) => {
    const emailId = args.emailId ?? ''
    const commentId = flagNonEmptyString(flags.commentId, '--comment-id')
    const messagesCursor = flagString(flags.messagesCursor)
    const cursor = flagString(flags.cursor)
    const isAll = flags.all === true
    if (messagesCursor !== undefined && commentId === undefined) {
      throw new CliUsageError(
        "--messages-cursor continues one thread: pass it with that thread's --comment-id."
      )
    }
    if (commentId !== undefined && cursor !== undefined) {
      throw new CliUsageError(
        '--cursor pages the thread list; --comment-id reads one thread. Follow its messagesCursor with --messages-cursor (or --all) instead.'
      )
    }
    const input = {
      include: flagString(flags.include),
      commentId,
      messagesCursor,
      limit: flagInt(flags.limit, '--limit'),
      cursor,
    }
    const comments = ctx.client().emails.comments
    const list = (page: Readonly<Record<string, unknown>>) =>
      comments.list(asSdkInput<ListEmailCommentsInput>({ ...page, emailId }))
    if (isAll && commentId !== undefined) {
      const thread = await readWholeThread(ctx, list, input)
      return {
        data: {
          data: thread === undefined ? [] : [thread],
          pagination: { cursor: null, hasMore: false },
        },
        human: renderThreads(thread === undefined ? [] : [thread]),
      }
    }
    if (isAll) {
      const rows = await collectAll(
        ctx,
        (next) =>
          list({ ...input, ...(next === undefined ? {} : { cursor: next }) }),
        { cursor }
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderThreads(rows),
      }
    }
    const page = await list(input)
    return { data: page, human: renderThreads(page.data) }
  },
})

async function readWholeThread(
  ctx: CliContext,
  list: (page: Readonly<Record<string, unknown>>) => Promise<CommentsPage>,
  input: Readonly<Record<string, unknown>> & {
    readonly messagesCursor: string | undefined
  }
): Promise<Thread | undefined> {
  const include = withMessages(input.include)
  let next = input.messagesCursor
  let thread: Thread | undefined
  let messages: Message[] = []
  let reads = 0
  const fetched = new Set<string>()
  for (;;) {
    let page: CommentsPage
    try {
      ctx.signal.throwIfAborted()
      page = await list({ ...input, include, messagesCursor: next })
    } catch (error) {
      if (reads > 0) {
        ctx.transport.setDrain({
          rowsFetched: messages.length,
          pagesFetched: reads,
          ...(next === undefined
            ? {}
            : {
                resumeCursor: next,
                resumeWith: `--comment-id ${String(input.commentId)} --messages-cursor ${next} --all`,
              }),
        })
      }
      throw error
    }
    reads += 1
    const slice = page.data[0]
    if (slice === undefined) {
      return thread === undefined
        ? undefined
        : { ...thread, messages, messagesCursor: null }
    }
    thread ??= slice
    messages = [...(slice.messages ?? []), ...messages]
    const older = slice.messagesCursor ?? null
    assertPaginationProgress({
      ctx,
      fetchedCursors: fetched,
      cursor: next,
      next: older,
      rowsFetched: messages.length,
      pagesFetched: reads,
    })
    if (older === null) {
      return { ...thread, messages, messagesCursor: null }
    }
    next = older
    progress(ctx, `Fetched ${messages.length} messages (page ${reads})…`)
  }
}

function withMessages(include: unknown): string {
  const tokens =
    typeof include === 'string'
      ? include
          .split(',')
          .map((token) => token.trim())
          .filter((token) => token.length > 0)
      : []
  return tokens.includes('messages')
    ? tokens.join(',')
    : [...tokens, 'messages'].join(',')
}

function renderThreads(threads: ReadonlyArray<Thread>): string {
  if (threads.length === 0) {
    return 'No open comment threads.'
  }
  if (!threads.some((thread) => thread.messages !== undefined)) {
    return renderTable(
      threads.map((thread) => ({
        commentId: thread.commentId,
        target: targetLabel(thread),
        messages: thread.messageCount,
        people: thread.participantCount,
        lastMessageAt: thread.lastMessageAt,
        preview: thread.lastMessagePreview,
      })),
      [
        { key: 'commentId', header: 'THREAD' },
        { key: 'target', header: 'ON' },
        { key: 'messages', header: 'MESSAGES' },
        { key: 'people', header: 'PEOPLE' },
        { key: 'lastMessageAt', header: 'LAST MESSAGE' },
        { key: 'preview', header: 'PREVIEW' },
      ]
    )
  }
  return threads.map(renderThreadMessages).join('\n\n')
}

function renderThreadMessages(thread: Thread): string {
  const count = `${thread.messageCount} message${thread.messageCount === 1 ? '' : 's'}`
  const head = `${thread.commentId} · ${targetLabel(thread)} · ${count} · ${thread.url}`
  const lines = (thread.messages ?? []).map(
    (message) =>
      `  ${message.author.name} (${message.createdAt}): ${message.body}`
  )
  const older =
    thread.messagesCursor === undefined || thread.messagesCursor === null
      ? []
      : [
          `  … older messages: --comment-id ${thread.commentId} --messages-cursor ${thread.messagesCursor}`,
        ]
  return [head, ...lines, ...older].join('\n')
}

function targetLabel(thread: Thread): string {
  const target = thread.target
  if (target.kind === 'email') {
    return 'email'
  }
  return target.elementId === undefined
    ? 'element'
    : `element ${target.elementId}`
}
