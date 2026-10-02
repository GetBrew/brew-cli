import type {
  EmailCommentMessage,
  EmailCommentThread,
  ListEmailCommentsInput,
  ListEmailCommentsResponse,
} from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import { asSdkInput, flagInt, flagString } from '../../../lib/input'
import { progress, renderTable } from '../../../lib/output'
import { CURSOR_FLAG, collectAll } from '../../../lib/paginate'
import type { CliContext } from '../../../lib/types'

type CommentsPage = ListEmailCommentsResponse
type Thread = EmailCommentThread
type Message = EmailCommentMessage

/**
 * One design's open comment threads, newest activity first, as the canvas
 * pins show them (resolving a thread deletes it). `--include messages` adds
 * each thread's newest messages and caps the page at 3 threads sharing a
 * fixed size budget; a thread with older messages carries a
 * `messagesCursor`, which `--comment-id` + `--messages-cursor` follows one
 * older slice at a time, and `--comment-id` + `--all` follows to the start.
 * A design with no open threads is an empty page; an unknown or other-brand
 * design is `404 EMAIL_NOT_FOUND`, and a `--comment-id` that is not an open
 * thread of it `404 COMMENT_NOT_FOUND`.
 */
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
    const commentId = flagString(flags.commentId)
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
      const rows = await collectAll(ctx, (next) =>
        list({ ...input, ...(next === undefined ? {} : { cursor: next }) })
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

/**
 * `--comment-id` + `--all`: the thread with every message, oldest first. Each
 * read returns the slice older than the cursor it was given (at least one
 * message) and the cursor for the slice before it, null at the start. A stop
 * mid-walk prints nothing, as `--all` never does, and reports how far it got
 * and the `--messages-cursor` to resume at. That includes a thread resolved
 * mid-walk, which the API answers with `404 COMMENT_NOT_FOUND`.
 */
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
          ...(next === undefined ? {} : { resumeCursor: next }),
        })
      }
      throw error
    }
    reads += 1
    const slice = page.data[0]
    if (slice === undefined) {
      // A thread that is not open is a 404, which ends the walk above; only
      // a deployment that predates COMMENT_NOT_FOUND answers an empty page.
      return thread === undefined
        ? undefined
        : { ...thread, messages, messagesCursor: null }
    }
    thread ??= slice
    messages = [...(slice.messages ?? []), ...messages]
    const older = slice.messagesCursor ?? null
    if (older === null || older === next) {
      return { ...thread, messages, messagesCursor: null }
    }
    next = older
    progress(ctx, `Fetched ${messages.length} messages (page ${reads})…`)
  }
}

/** `messages` added to an include list, once. */
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
