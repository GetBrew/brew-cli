import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import {
  type RunCliOptions,
  type RunCliResult,
  runCli,
} from '../helpers/run-cli'

/**
 * The typed reads that replaced the data command's tables (brew-v2#1828,
 * #1830, #1831): `insights list/get`, `emails comments list`, `chats list`,
 * `notifications list`, and `--include` on `domains health`, `contacts get`
 * and `contacts search`. Each asserts the request the command makes, what it
 * prints, how it pages and how it fails.
 */

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const API = 'https://brew.new/api'
const BRAND = 'kx7b3s7fapqz8mjm12ekz1kxdx87yceg'
const PAGE_DONE = { limit: 100, cursor: null, hasMore: false }

function cli(
  argv: readonly string[],
  options: Omit<RunCliOptions, 'env'> = {}
): Promise<RunCliResult> {
  return runCli(argv, {
    ...options,
    env: {
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
      BREW_API_KEY: KEY,
      BREW_BRAND_ID: BRAND,
    },
  })
}

/** An API error shaped like the real envelope (`suggestion`/`docs` required). */
function apiError(
  status: number,
  code: string,
  message: string,
  param?: string
): Response {
  return HttpResponse.json(
    {
      error: {
        code,
        type: status === 404 ? 'not_found' : 'invalid_request',
        message,
        ...(param === undefined ? {} : { param }),
        suggestion: 'Check the request and retry.',
        docs: 'https://docs.brew.new/api-reference/api/errors',
      },
    },
    { status }
  )
}

function errorCode(result: RunCliResult): string {
  return (JSON.parse(result.stderr) as { error: { code: string } }).error.code
}

const FRESHNESS = {
  dataAsOf: '2026-10-02T06:00:00.000Z',
  lastSuccessfulRunAt: '2026-10-02T06:05:00.000Z',
  latestAttempt: { status: 'succeeded', at: '2026-10-02T06:05:00.000Z' },
}

const FINDING = {
  insightId: 'k17a8m2v4w5x6y7z8a9b0c1d2e3f4g5h',
  title: 'Bounce rate doubled on news.acme.com',
  description: 'Hard bounces rose from 0.8% to 1.9% over the last 7 days.',
  severity: 'critical',
  confidence: 'high',
  kind: 'insight',
  category: 'deliverability',
  detectorId: 'bounce_spike',
  state: 'active',
  firstSeenAt: '2026-09-30T06:00:00.000Z',
  lastSeenAt: '2026-10-02T06:00:00.000Z',
  recurrenceCount: 2,
  url: 'https://brew.new/insights/k17a8m2v4w5x6y7z8a9b0c1d2e3f4g5h',
}

const SECOND_FINDING = {
  ...FINDING,
  insightId: 'm29b0n4x6y7z8a9b0c1d2e3f4g5h6i7j',
  title: 'Tuesday sends open best',
  severity: 'opportunity',
  category: 'timing',
  detectorId: 'best_send_day',
}

const PULSE = {
  windowEnd: '2026-10-01T00:00:00.000Z',
  delivered: 1200,
  priorDelivered: 1100,
  uniqueOpens: 420,
  priorUniqueOpens: 400,
  uniqueClicks: 60,
  priorUniqueClicks: 66,
  unsubscribed: 3,
  priorUnsubscribed: 4,
  openRatePct: 35,
  priorOpenRatePct: 36.4,
  clickRatePct: 5,
  priorClickRatePct: null,
  openDirection: 'down',
  clickDirection: 'steady',
  countsOnly: false,
  measured: true,
}

const REPORT = {
  reportId: 'rpt_1',
  chatId: 'Hk2mZ8t9QbY3sW1vR0pLd',
  runTrigger: 'scheduled',
  createdAt: '2026-10-01T07:00:00.000Z',
  insights: [
    {
      key: 'k1',
      kind: 'risk',
      title: 'Bounces are climbing on the newsletter domain',
      body: 'Three sends in a row bounced above 1.5%.',
      impact: null,
      suggestionId: 'sug_1',
    },
  ],
}

const SUGGESTION = {
  suggestionId: 'sug_1',
  title: 'Validate the newsletter list',
  prompt: 'Validate every contact in the Newsletter audience.',
  kind: 'deliverability',
  status: 'proposed',
  rationale: null,
  sourceInsightKeys: ['k1'],
  executionChatId: null,
  createdAt: '2026-10-01T07:00:00.000Z',
  updatedAt: '2026-10-01T07:00:00.000Z',
}

const MEMO = {
  markdown: '## What we watch\n- bounce rate on news.acme.com',
  version: 4,
  updatedAt: '2026-10-01T07:00:00.000Z',
  updatedByChatId: null,
}

describe('insights list', () => {
  it('maps --state/--severity/--include/--limit/--cursor onto the query and prints the page verbatim', async () => {
    let url: URL | undefined
    const page = {
      data: [FINDING],
      pagination: PAGE_DONE,
      freshness: FRESHNESS,
      pulse: PULSE,
    }
    server.use(
      http.get(`${API}/v1/insights`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json(page)
      })
    )
    const result = await cli([
      'insights',
      'list',
      '--state',
      'all',
      '--severity',
      'critical',
      '--include',
      'pulse',
      '--limit',
      '20',
      '--cursor',
      'ofs_20',
    ])
    expect(result.code).toBe(0)
    expect(url?.pathname).toBe('/api/v1/insights')
    expect(url?.searchParams.get('state')).toBe('all')
    expect(url?.searchParams.get('severity')).toBe('critical')
    expect(url?.searchParams.get('include')).toBe('pulse')
    expect(url?.searchParams.get('limit')).toBe('20')
    expect(url?.searchParams.get('cursor')).toBe('ofs_20')
    expect(result.json).toEqual(page)
  })

  it('sends no query parameters it was not given', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/insights`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          data: [],
          pagination: PAGE_DONE,
          freshness: FRESHNESS,
        })
      })
    )
    const result = await cli(['insights', 'list'])
    expect(result.code).toBe(0)
    expect([...(url?.searchParams.keys() ?? [])]).toEqual([])
  })

  it('leads a TTY table with the freshness, and flags a failed run as possibly stale', async () => {
    server.use(
      http.get(`${API}/v1/insights`, () =>
        HttpResponse.json({
          data: [FINDING, SECOND_FINDING],
          pagination: PAGE_DONE,
          freshness: {
            ...FRESHNESS,
            latestAttempt: { status: 'failed', at: '2026-10-02T07:00:00.000Z' },
          },
        })
      )
    )
    const result = await cli(['insights', 'list'], { ttyOut: true })
    expect(result.code).toBe(0)
    const [freshness, , header, first, second] = result.stdout.split('\n')
    expect(freshness).toBe(
      'Data as of 2026-10-02T06:00:00.000Z; latest run failed at 2026-10-02T07:00:00.000Z; these findings may be stale.'
    )
    expect(header).toMatch(/^SEVERITY\s+TITLE\s+STATE\s+CATEGORY\s+INSIGHT$/)
    expect(first).toContain('critical')
    expect(first).toContain(FINDING.insightId)
    expect(second).toContain('Tuesday sends open best')
  })

  it('says when no run has finished and nothing is found', async () => {
    server.use(
      http.get(`${API}/v1/insights`, () =>
        HttpResponse.json({
          data: [],
          pagination: PAGE_DONE,
          freshness: {
            dataAsOf: null,
            lastSuccessfulRunAt: null,
            latestAttempt: null,
          },
        })
      )
    )
    const result = await cli(['insights', 'list'], { ttyOut: true })
    expect(result.code).toBe(0)
    expect(result.stdout).toBe(
      'No insight run has finished yet.\n\nNo insights found.\n'
    )
  })

  it('renders each expansion it asked for on a TTY, and says which do not exist yet', async () => {
    server.use(
      http.get(`${API}/v1/insights`, ({ request }) => {
        const include = new URL(request.url).searchParams.get('include')
        return HttpResponse.json(
          include === 'pulse,report,suggestions,memo'
            ? {
                data: [FINDING],
                pagination: PAGE_DONE,
                freshness: FRESHNESS,
                pulse: PULSE,
                report: REPORT,
                suggestions: [SUGGESTION],
                memo: MEMO,
              }
            : {
                data: [FINDING],
                pagination: PAGE_DONE,
                freshness: FRESHNESS,
                pulse: null,
                report: null,
                suggestions: [],
                memo: null,
              }
        )
      })
    )
    const full = await cli(
      ['insights', 'list', '--include', 'pulse,report,suggestions,memo'],
      { ttyOut: true }
    )
    expect(full.code).toBe(0)
    expect(full.stdout).toContain(
      'Pulse, 7 days to 2026-10-01T00:00:00.000Z:\n  delivered 1200 (prior 1100)'
    )
    expect(full.stdout).toContain('open rate 35% (prior 36.4%, down)')
    expect(full.stdout).toContain('click rate 5% (prior -, steady)')
    expect(full.stdout).toContain(
      'Report rpt_1 (scheduled, 2026-10-01T07:00:00.000Z; chat Hk2mZ8t9QbY3sW1vR0pLd):\n  [risk] Bounces are climbing on the newsletter domain'
    )
    expect(full.stdout).toMatch(/Suggestions:\nSUGGESTION\s+STATUS\s+KIND/)
    expect(full.stdout).toContain('sug_1')
    expect(full.stdout).toContain(
      'Memo v4 (updated 2026-10-01T07:00:00.000Z):\n## What we watch'
    )

    const empty = await cli(
      ['insights', 'list', '--include', 'pulse,report,suggestions'],
      { ttyOut: true }
    )
    expect(empty.stdout).toContain('Pulse: none yet.')
    expect(empty.stdout).toContain('Report: none yet.')
    expect(empty.stdout).toContain('Suggestions: none.')
    expect(empty.stdout).toContain('Memo: none yet.')
  })

  it('--all merges every page, asks for the expansions once and keeps them beside the rows', async () => {
    const seen: Array<URLSearchParams> = []
    server.use(
      http.get(`${API}/v1/insights`, ({ request }) => {
        const params = new URL(request.url).searchParams
        seen.push(params)
        return HttpResponse.json(
          params.get('cursor') === null
            ? {
                data: [FINDING],
                pagination: { limit: 1, cursor: 'ofs_1', hasMore: true },
                freshness: FRESHNESS,
                memo: MEMO,
              }
            : {
                data: [SECOND_FINDING],
                pagination: { limit: 1, cursor: null, hasMore: false },
                freshness: FRESHNESS,
              }
        )
      })
    )
    const result = await cli([
      'insights',
      'list',
      '--all',
      '--limit',
      '1',
      '--include',
      'memo',
      '--severity',
      'critical',
    ])
    expect(result.code).toBe(0)
    expect(seen).toHaveLength(2)
    expect(seen[0]?.get('include')).toBe('memo')
    expect(seen[1]?.get('include')).toBeNull()
    expect(seen[1]?.get('cursor')).toBe('ofs_1')
    expect(seen[1]?.get('severity')).toBe('critical')
    expect(seen[1]?.get('limit')).toBe('1')
    expect(result.json).toEqual({
      data: [FINDING, SECOND_FINDING],
      pagination: { cursor: null, hasMore: false },
      freshness: FRESHNESS,
      memo: MEMO,
    })
  })

  it("surfaces the API's 400 for an unknown include token", async () => {
    server.use(
      http.get(`${API}/v1/insights`, () =>
        apiError(
          400,
          'INVALID_REQUEST',
          'Unknown include token: graph.',
          'include'
        )
      )
    )
    const result = await cli(['insights', 'list', '--include', 'graph'])
    expect(result.code).toBe(1)
    expect(errorCode(result)).toBe('INVALID_REQUEST')
  })
})

describe('insights get', () => {
  it('reads one finding by id and prints the bare row', async () => {
    let path: string | undefined
    const detail = {
      ...FINDING,
      rationale: 'Two sends bounced above 1.5%.',
      closedReason: null,
      closedAt: null,
      lastActedAt: null,
      churnCount: 0,
      metrics: { bounceRate: { kind: 'label', text: '1.9%' } },
      evidence: [{ label: 'Send report', url: 'https://brew.new/sends/snd_1' }],
      subject: { kind: 'domain', id: 'dom_1', label: 'news.acme.com' },
      method: null,
      generatedBy: null,
      freshness: FRESHNESS,
    }
    server.use(
      http.get(`${API}/v1/insights/:insightId`, ({ request }) => {
        path = new URL(request.url).pathname
        return HttpResponse.json(detail)
      })
    )
    const result = await cli(['insights', 'get', FINDING.insightId])
    expect(result.code).toBe(0)
    expect(path).toBe(`/api/v1/insights/${FINDING.insightId}`)
    expect(result.json).toEqual(detail)
  })

  it('exits 1 with INSIGHT_NOT_FOUND for an unknown or other-brand id', async () => {
    server.use(
      http.get(`${API}/v1/insights/:insightId`, () =>
        apiError(404, 'INSIGHT_NOT_FOUND', 'No insight matches that id.')
      )
    )
    const result = await cli(['insights', 'get', 'nope'])
    expect(result.code).toBe(1)
    expect(errorCode(result)).toBe('INSIGHT_NOT_FOUND')
  })
})

const AUTHOR = { userId: 'usr_1', name: 'Jane Doe' }
const TEAMMATE = { userId: 'usr_2', name: 'Sam Lee' }

function thread(
  commentId: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    commentId,
    emailId: 'em_1',
    status: 'open',
    target: { kind: 'element', elementId: 'hero-image', nodeType: 'Img' },
    participants: [AUTHOR, TEAMMATE],
    participantCount: 2,
    messageCount: 3,
    lastMessageAt: '2026-10-02T09:00:00.000Z',
    lastMessagePreview: 'Can we try a darker hero?',
    url: `https://brew.new/emails/em_1?comment=${commentId}`,
    ...extra,
  }
}

function message(messageId: string, body: string, minute: number) {
  const at = `2026-10-02T09:${String(minute).padStart(2, '0')}:00.000Z`
  return {
    messageId,
    author: minute % 2 === 0 ? AUTHOR : TEAMMATE,
    body,
    mentions: [],
    createdAt: at,
    updatedAt: at,
  }
}

describe('emails comments list', () => {
  it("reads the design's threads with --include/--limit and prints the page verbatim", async () => {
    let url: URL | undefined
    const page = {
      data: [thread('cmt_1', { messages: [], messagesCursor: null })],
      pagination: PAGE_DONE,
    }
    server.use(
      http.get(`${API}/v1/emails/:emailId/comments`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json(page)
      })
    )
    const result = await cli([
      'emails',
      'comments',
      'list',
      'em_1',
      '--include',
      'messages',
      '--limit',
      '3',
    ])
    expect(result.code).toBe(0)
    expect(url?.pathname).toBe('/api/v1/emails/em_1/comments')
    expect(url?.searchParams.get('include')).toBe('messages')
    expect(url?.searchParams.get('limit')).toBe('3')
    expect(result.json).toEqual(page)
  })

  it('reads one thread with --comment-id and --messages-cursor', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/emails/:emailId/comments`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ data: [], pagination: PAGE_DONE })
      })
    )
    const result = await cli([
      'emails',
      'comments',
      'list',
      'em_1',
      '--comment-id',
      'cmt_1',
      '--messages-cursor',
      'mc_older',
    ])
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('commentId')).toBe('cmt_1')
    expect(url?.searchParams.get('messagesCursor')).toBe('mc_older')
  })

  it('shows a TTY table of threads, and each thread with its messages under --include messages', async () => {
    server.use(
      http.get(`${API}/v1/emails/:emailId/comments`, ({ request }) =>
        HttpResponse.json(
          new URL(request.url).searchParams.get('include') === 'messages'
            ? {
                data: [
                  thread('cmt_1', {
                    messages: [
                      message('cmm_2', 'The hero feels washed out.', 2),
                      {
                        ...message(
                          'cmm_3',
                          'Can we try a darker hero, @Jane Doe?',
                          3
                        ),
                        mentions: [AUTHOR],
                      },
                    ],
                    messagesCursor: 'mc_1',
                  }),
                ],
                pagination: PAGE_DONE,
              }
            : {
                data: [
                  thread('cmt_1'),
                  thread('cmt_2', { target: { kind: 'email' } }),
                ],
                pagination: PAGE_DONE,
              }
        )
      )
    )
    const table = await cli(['emails', 'comments', 'list', 'em_1'], {
      ttyOut: true,
    })
    expect(table.code).toBe(0)
    const [header, first, second] = table.stdout.split('\n')
    expect(header).toMatch(
      /^THREAD\s+ON\s+MESSAGES\s+PEOPLE\s+LAST MESSAGE\s+PREVIEW$/
    )
    expect(first).toContain('element hero-image')
    expect(second).toMatch(/^cmt_2\s+email\s+3/)

    const withMessages = await cli(
      ['emails', 'comments', 'list', 'em_1', '--include', 'messages'],
      { ttyOut: true }
    )
    expect(withMessages.stdout).toBe(
      [
        'cmt_1 · element hero-image · 3 messages · https://brew.new/emails/em_1?comment=cmt_1',
        '  Jane Doe (2026-10-02T09:02:00.000Z): The hero feels washed out.',
        '  Sam Lee (2026-10-02T09:03:00.000Z): Can we try a darker hero, @Jane Doe?',
        '  … older messages: --comment-id cmt_1 --messages-cursor mc_1',
        '',
      ].join('\n')
    )
  })

  it('says so when the design has no open threads', async () => {
    server.use(
      http.get(`${API}/v1/emails/:emailId/comments`, () =>
        HttpResponse.json({ data: [], pagination: PAGE_DONE })
      )
    )
    const result = await cli(['emails', 'comments', 'list', 'em_1'], {
      ttyOut: true,
    })
    expect(result.stdout).toBe('No open comment threads.\n')
  })

  it('refuses --messages-cursor without --comment-id, and --cursor with it, before sending', async () => {
    let calls = 0
    server.use(
      http.get(`${API}/v1/emails/:emailId/comments`, () => {
        calls += 1
        return HttpResponse.json({ data: [], pagination: PAGE_DONE })
      })
    )
    const orphan = await cli([
      'emails',
      'comments',
      'list',
      'em_1',
      '--messages-cursor',
      'mc_1',
    ])
    expect(orphan.code).toBe(2)
    expect(orphan.stderr).toContain('--comment-id')
    const paged = await cli([
      'emails',
      'comments',
      'list',
      'em_1',
      '--comment-id',
      'cmt_1',
      '--cursor',
      'c_1',
    ])
    expect(paged.code).toBe(2)
    expect(paged.stderr).toContain('--messages-cursor')
    expect(calls).toBe(0)
  })

  it('--all follows the thread cursor and returns every thread as one page', async () => {
    const cursors: Array<string | null> = []
    server.use(
      http.get(`${API}/v1/emails/:emailId/comments`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        cursors.push(cursor)
        return HttpResponse.json(
          cursor === null
            ? {
                data: [thread('cmt_1')],
                pagination: { limit: 1, cursor: 'c_1', hasMore: true },
              }
            : {
                data: [thread('cmt_2')],
                pagination: { limit: 1, cursor: null, hasMore: false },
              }
        )
      })
    )
    const result = await cli([
      'emails',
      'comments',
      'list',
      'em_1',
      '--all',
      '--limit',
      '1',
    ])
    expect(result.code).toBe(0)
    expect(cursors).toEqual([null, 'c_1'])
    expect(result.json).toEqual({
      data: [thread('cmt_1'), thread('cmt_2')],
      pagination: { cursor: null, hasMore: false },
    })
  })

  it('--comment-id --all walks the messagesCursor and prints the whole thread, oldest first', async () => {
    const reads: Array<URLSearchParams> = []
    const slices: Record<string, Record<string, unknown>> = {
      newest: thread('cmt_1', {
        messageCount: 5,
        messages: [message('cmm_4', 'four', 4), message('cmm_5', 'five', 5)],
        messagesCursor: 'mc_a',
      }),
      mc_a: thread('cmt_1', {
        messageCount: 5,
        messages: [message('cmm_2', 'two', 2), message('cmm_3', 'three', 3)],
        messagesCursor: 'mc_b',
      }),
      mc_b: thread('cmt_1', {
        messageCount: 5,
        messages: [message('cmm_1', 'one', 1)],
        messagesCursor: null,
      }),
    }
    server.use(
      http.get(`${API}/v1/emails/:emailId/comments`, ({ request }) => {
        const params = new URL(request.url).searchParams
        reads.push(params)
        const slice = slices[params.get('messagesCursor') ?? 'newest']
        return HttpResponse.json({
          data: slice === undefined ? [] : [slice],
          pagination: PAGE_DONE,
        })
      })
    )
    const result = await cli([
      'emails',
      'comments',
      'list',
      'em_1',
      '--comment-id',
      'cmt_1',
      '--all',
    ])
    expect(result.code).toBe(0)
    expect(reads.map((params) => params.get('messagesCursor'))).toEqual([
      null,
      'mc_a',
      'mc_b',
    ])
    for (const params of reads) {
      expect(params.get('commentId')).toBe('cmt_1')
      expect(params.get('include')).toBe('messages')
      expect(params.get('cursor')).toBeNull()
    }
    const body = result.json as {
      data: Array<{
        messages: Array<{ messageId: string }>
        messagesCursor: string | null
      }>
      pagination: unknown
    }
    expect(body.data).toHaveLength(1)
    expect(body.data[0]?.messages.map((m) => m.messageId)).toEqual([
      'cmm_1',
      'cmm_2',
      'cmm_3',
      'cmm_4',
      'cmm_5',
    ])
    expect(body.data[0]?.messagesCursor).toBeNull()
    expect(body.pagination).toEqual({ cursor: null, hasMore: false })
  })

  it('exits 1 with EMAIL_NOT_FOUND for a design the brand does not have', async () => {
    server.use(
      http.get(`${API}/v1/emails/:emailId/comments`, () =>
        apiError(404, 'EMAIL_NOT_FOUND', 'No email matches that id.', 'emailId')
      )
    )
    const result = await cli(['emails', 'comments', 'list', 'em_nope'])
    expect(result.code).toBe(1)
    expect(result.stdout).toBe('')
    expect(errorCode(result)).toBe('EMAIL_NOT_FOUND')
  })

  it('--comment-id --all on a thread that is not open exits 1 with COMMENT_NOT_FOUND and prints nothing', async () => {
    server.use(
      http.get(`${API}/v1/emails/:emailId/comments`, () =>
        apiError(
          404,
          'COMMENT_NOT_FOUND',
          'No open comment thread matches that id.',
          'commentId'
        )
      )
    )
    const result = await cli([
      'emails',
      'comments',
      'list',
      'em_1',
      '--comment-id',
      'cmt_gone',
      '--all',
    ])
    expect(result.code).toBe(1)
    expect(result.stdout).toBe('')
    const envelope = JSON.parse(result.stderr) as {
      error: { code: string; progress?: unknown }
    }
    expect(envelope.error.code).toBe('COMMENT_NOT_FOUND')
    // Nothing was read yet, so there is no walk to resume.
    expect(envelope.error.progress).toBeUndefined()
  })

  it('a thread resolved mid-walk (COMMENT_NOT_FOUND) prints no partial thread and reports the --messages-cursor it stopped at', async () => {
    server.use(
      http.get(`${API}/v1/emails/:emailId/comments`, ({ request }) => {
        const params = new URL(request.url).searchParams
        if (params.get('messagesCursor') === null) {
          return HttpResponse.json({
            data: [
              thread('cmt_1', {
                messages: [message('cmm_4', 'four', 4)],
                messagesCursor: 'mc_a',
              }),
            ],
            pagination: PAGE_DONE,
          })
        }
        return apiError(
          404,
          'COMMENT_NOT_FOUND',
          'No open comment thread matches that id.',
          'commentId'
        )
      })
    )
    const result = await cli([
      'emails',
      'comments',
      'list',
      'em_1',
      '--comment-id',
      'cmt_1',
      '--all',
    ])
    expect(result.code).toBe(1)
    expect(result.stdout).toBe('')
    // stderr: the walk's progress line, then the envelope.
    const [progressLine, envelopeLine] = result.stderr.trimEnd().split('\n')
    expect(progressLine).toBe('Fetched 1 messages (page 1)…')
    const envelope = JSON.parse(envelopeLine ?? '') as {
      error: { code: string; progress?: Record<string, unknown> }
    }
    expect(envelope.error.code).toBe('COMMENT_NOT_FOUND')
    expect(envelope.error.progress).toEqual({
      rowsFetched: 1,
      pagesFetched: 1,
      resumeCursor: 'mc_a',
      resumeWith: '--comment-id cmt_1 --messages-cursor mc_a --all',
    })
  })

  it('on a TTY, a stopped thread walk says to resume with --comment-id and --messages-cursor, never --cursor', async () => {
    server.use(
      http.get(`${API}/v1/emails/:emailId/comments`, ({ request }) => {
        if (new URL(request.url).searchParams.get('messagesCursor') === null) {
          return HttpResponse.json({
            data: [
              thread('cmt_1', {
                messages: [message('cmm_4', 'four', 4)],
                messagesCursor: 'mc_a',
              }),
            ],
            pagination: PAGE_DONE,
          })
        }
        return apiError(
          404,
          'COMMENT_NOT_FOUND',
          'No open comment thread matches that id.',
          'commentId'
        )
      })
    )
    const result = await cli(
      ['emails', 'comments', 'list', 'em_1', '--comment-id', 'cmt_1', '--all'],
      { ttyOut: true }
    )
    expect(result.code).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain(
      'Fetched 1 rows in 1 pages before stopping; resume with --comment-id cmt_1 --messages-cursor mc_a --all.'
    )
    expect(result.stderr).not.toContain('--cursor mc_a')
  })
})

const CHAT = {
  chatId: 'Hk2mZ8t9QbY3sW1vR0pLd',
  title: 'Black Friday teaser',
  firstUserPrompt: 'Draft a teaser for Black Friday',
  lastAssistantPreview: 'Here is a first draft…',
  status: 'completed',
  origin: null,
  updatedAt: '2026-10-02T08:00:00.000Z',
  url: 'https://brew.new/chat/Hk2mZ8t9QbY3sW1vR0pLd',
}

describe('chats list', () => {
  it('maps --limit/--cursor onto the query and prints the page verbatim', async () => {
    let url: URL | undefined
    const page = { data: [CHAT], pagination: PAGE_DONE }
    server.use(
      http.get(`${API}/v1/chats`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json(page)
      })
    )
    const result = await cli([
      'chats',
      'list',
      '--limit',
      '10',
      '--cursor',
      'native_1',
    ])
    expect(result.code).toBe(0)
    expect(url?.pathname).toBe('/api/v1/chats')
    expect(url?.searchParams.get('limit')).toBe('10')
    expect(url?.searchParams.get('cursor')).toBe('native_1')
    expect(result.json).toEqual(page)
  })

  it('shows an untitled chat by its opening prompt on a TTY, on one line', async () => {
    server.use(
      http.get(`${API}/v1/chats`, () =>
        HttpResponse.json({
          data: [
            CHAT,
            {
              ...CHAT,
              chatId: 'Zz9yX8w7V6u5T4s3R2q1P',
              title: null,
              firstUserPrompt: `Write a welcome series\nfor ${'new trial users who signed up through the pricing page '.repeat(2)}`,
              status: 'streaming',
              origin: 'slack',
            },
          ],
          pagination: PAGE_DONE,
        })
      )
    )
    const result = await cli(['chats', 'list'], { ttyOut: true })
    expect(result.code).toBe(0)
    const [header, first, second] = result.stdout.split('\n')
    expect(header).toMatch(/^CHAT\s+TITLE\s+STATUS\s+ORIGIN\s+UPDATED$/)
    expect(first).toMatch(/Black Friday teaser\s+completed\s+web/)
    expect(second).toContain('Write a welcome series for new trial users')
    expect(second).toContain('…')
    expect(second).toMatch(/streaming\s+slack/)
  })

  it('on a TTY, a stopped --all still says to resume with --cursor', async () => {
    server.use(
      http.get(`${API}/v1/chats`, ({ request }) =>
        new URL(request.url).searchParams.get('cursor') === null
          ? HttpResponse.json({
              data: [CHAT],
              pagination: { limit: 1, cursor: 'native_1', hasMore: true },
            })
          : apiError(400, 'INVALID_REQUEST', 'Invalid cursor.', 'cursor')
      )
    )
    const result = await cli(['chats', 'list', '--all'], { ttyOut: true })
    expect(result.code).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain(
      'Fetched 1 rows in 1 pages before stopping; resume with --cursor native_1 --all.'
    )
  })

  it('--all drains every page', async () => {
    const cursors: Array<string | null> = []
    server.use(
      http.get(`${API}/v1/chats`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        cursors.push(cursor)
        return HttpResponse.json(
          cursor === null
            ? {
                data: [CHAT],
                pagination: { limit: 1, cursor: 'native_1', hasMore: true },
              }
            : {
                data: [{ ...CHAT, chatId: 'Zz9yX8w7V6u5T4s3R2q1P' }],
                pagination: { limit: 1, cursor: null, hasMore: false },
              }
        )
      })
    )
    const result = await cli(['chats', 'list', '--all'])
    expect(result.code).toBe(0)
    expect(cursors).toEqual([null, 'native_1'])
    expect((result.json as { data: unknown[] }).data).toHaveLength(2)
  })
})

const NOTIFICATION = {
  notificationId: 'ntf_0123456789abcdef0123',
  type: 'email_send_failed',
  status: 'failed',
  title: 'Send failed',
  subtitle: 'October newsletter',
  emailId: 'em_1',
  url: 'https://brew.new/emails/em_1',
  isPersonal: false,
  createdAt: '2026-10-02T08:00:00.000Z',
  updatedAt: '2026-10-02T08:00:00.000Z',
}

describe('notifications list', () => {
  it('maps --type/--limit/--cursor onto the query and prints the page verbatim', async () => {
    let url: URL | undefined
    const page = { data: [NOTIFICATION], pagination: PAGE_DONE }
    server.use(
      http.get(`${API}/v1/notifications`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json(page)
      })
    )
    const result = await cli([
      'notifications',
      'list',
      '--type',
      'email_send_failed',
      '--limit',
      '5',
      '--cursor',
      'native_1',
    ])
    expect(result.code).toBe(0)
    expect(url?.pathname).toBe('/api/v1/notifications')
    expect(url?.searchParams.get('type')).toBe('email_send_failed')
    expect(url?.searchParams.get('limit')).toBe('5')
    expect(url?.searchParams.get('cursor')).toBe('native_1')
    expect(result.json).toEqual(page)
  })

  it('never lets a short or empty page read as the end on a TTY', async () => {
    server.use(
      http.get(`${API}/v1/notifications`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        if (cursor === null) {
          return HttpResponse.json({
            data: [NOTIFICATION],
            pagination: { limit: 25, cursor: 'native_1', hasMore: true },
          })
        }
        if (cursor === 'native_1') {
          return HttpResponse.json({
            data: [],
            pagination: { limit: 25, cursor: 'native_2', hasMore: true },
          })
        }
        return HttpResponse.json({ data: [], pagination: PAGE_DONE })
      })
    )
    const short = await cli(['notifications', 'list', '--limit', '25'], {
      ttyOut: true,
    })
    const lines = short.stdout.trimEnd().split('\n')
    expect(lines[0]).toMatch(/^NOTIFICATION\s+TYPE\s+STATUS\s+TITLE\s+CREATED$/)
    expect(lines[1]).toMatch(
      /^ntf_0123456789abcdef0123\s+email_send_failed\s+failed\s+Send failed/
    )
    expect(lines[2]).toBe('More follow: --cursor native_1')

    const empty = await cli(['notifications', 'list', '--cursor', 'native_1'], {
      ttyOut: true,
    })
    expect(empty.stdout).toBe(
      'No notifications on this page. More follow: --cursor native_2\n'
    )

    const end = await cli(['notifications', 'list', '--cursor', 'native_2'], {
      ttyOut: true,
    })
    expect(end.stdout).toBe('No notifications this key can see.\n')
  })

  it('--all drains past an empty page that still has more', async () => {
    const cursors: Array<string | null> = []
    server.use(
      http.get(`${API}/v1/notifications`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        cursors.push(cursor)
        if (cursor === null) {
          return HttpResponse.json({
            data: [NOTIFICATION],
            pagination: { limit: 100, cursor: 'native_1', hasMore: true },
          })
        }
        if (cursor === 'native_1') {
          return HttpResponse.json({
            data: [],
            pagination: { limit: 100, cursor: 'native_2', hasMore: true },
          })
        }
        return HttpResponse.json({
          data: [
            { ...NOTIFICATION, notificationId: 'ntf_fedcba9876543210fedc' },
          ],
          pagination: PAGE_DONE,
        })
      })
    )
    const result = await cli(['notifications', 'list', '--all'])
    expect(result.code).toBe(0)
    expect(cursors).toEqual([null, 'native_1', 'native_2'])
    expect(result.json).toEqual({
      data: [
        NOTIFICATION,
        { ...NOTIFICATION, notificationId: 'ntf_fedcba9876543210fedc' },
      ],
      pagination: { cursor: null, hasMore: false },
    })
  })

  it("surfaces the API's 400 for an unknown --type", async () => {
    server.use(
      http.get(`${API}/v1/notifications`, () =>
        apiError(400, 'INVALID_REQUEST', 'Unknown type: nope.', 'type')
      )
    )
    const result = await cli(['notifications', 'list', '--type', 'nope'])
    expect(result.code).toBe(1)
    expect(errorCode(result)).toBe('INVALID_REQUEST')
  })
})

describe('brand scoping', () => {
  it.each([
    [['insights', 'list'], '/v1/insights'],
    [['insights', 'get', 'k1'], '/v1/insights/k1'],
    [['emails', 'comments', 'list', 'em_1'], '/v1/emails/em_1/comments'],
    [['chats', 'list'], '/v1/chats'],
    [['notifications', 'list'], '/v1/notifications'],
  ])('%j sends the brand binding', async (argv, path) => {
    let brand: string | null = null
    server.use(
      http.get(`${API}${path}`, ({ request }) => {
        brand = request.headers.get('x-brand-id')
        return HttpResponse.json({
          data: [],
          pagination: PAGE_DONE,
          freshness: FRESHNESS,
        })
      })
    )
    const result = await cli(argv)
    expect(result.code).toBe(0)
    expect(brand).toBe(BRAND)
  })
})

describe('domains health --include', () => {
  it('passes scoreHistory,scoreRuns as the include query, and nothing without the flag', async () => {
    const includes: Array<string | null> = []
    server.use(
      http.get(`${API}/v1/domains/:domainId/health`, ({ request }) => {
        includes.push(new URL(request.url).searchParams.get('include'))
        return HttpResponse.json({
          domainId: 'dom_1',
          name: 'news.acme.com',
          scoreHistory: [],
          scoreRuns: [],
        })
      })
    )
    const withInclude = await cli([
      'domains',
      'health',
      'dom_1',
      '--include',
      'scoreHistory,scoreRuns',
    ])
    expect(withInclude.code).toBe(0)
    expect(
      (withInclude.json as { scoreHistory: unknown[] }).scoreHistory
    ).toEqual([])
    const without = await cli(['domains', 'health', 'dom_1'])
    expect(without.code).toBe(0)
    expect(includes).toEqual(['scoreHistory,scoreRuns', null])
  })
})

const OPEN_PROFILE = {
  totalOpens: 14,
  lastOpenedAt: '2026-10-01T15:30:00.000Z',
  bestOpenMinuteUtc: 930,
  bestSendMinuteUtc: 900,
  confidence: 0.7,
  histogram: Array.from({ length: 48 }, () => 0),
}

describe('contacts get --include', () => {
  it('passes openProfile as the include query on the encoded address', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/contacts/:email`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          email: 'a+b@example.com',
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
          openProfile: OPEN_PROFILE,
        })
      })
    )
    const result = await cli([
      'contacts',
      'get',
      'a+b@example.com',
      '--include',
      'openProfile',
    ])
    expect(result.code).toBe(0)
    expect(url?.pathname).toBe('/api/v1/contacts/a%2Bb%40example.com')
    expect(url?.searchParams.get('include')).toBe('openProfile')
    expect(
      (result.json as { openProfile: typeof OPEN_PROFILE }).openProfile
    ).toEqual(OPEN_PROFILE)
  })

  it('surfaces the 403 when the key lacks the emails scope', async () => {
    server.use(
      http.get(`${API}/v1/contacts/:email`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              type: 'permission_denied',
              message: 'include=openProfile needs the emails scope.',
              suggestion: 'Use a key with the emails scope.',
              docs: 'https://docs.brew.new/api-reference/api/errors',
            },
          },
          { status: 403 }
        )
      )
    )
    const result = await cli([
      'contacts',
      'get',
      'jane@example.com',
      '--include',
      'openProfile',
    ])
    expect(result.code).not.toBe(0)
    expect(errorCode(result)).toBe('INSUFFICIENT_PERMISSIONS')
  })
})

describe('contacts search --include', () => {
  it('sends include as an array in the body and shows opens and the best send time on a TTY', async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.post(`${API}/v1/contacts/search`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          data: [
            {
              email: 'jane@example.com',
              firstName: 'Jane',
              subscribed: true,
              createdAt: '2026-09-01T00:00:00.000Z',
              updatedAt: '2026-09-01T00:00:00.000Z',
              openProfile: OPEN_PROFILE,
            },
            {
              email: 'sam@example.com',
              firstName: 'Sam',
              subscribed: true,
              createdAt: '2026-09-01T00:00:00.000Z',
              updatedAt: '2026-09-01T00:00:00.000Z',
              openProfile: null,
            },
          ],
          pagination: { limit: 10, cursor: null, hasMore: false },
        })
      })
    )
    const result = await cli(
      ['contacts', 'search', '--audience', 'aud_1', '--include', 'openProfile'],
      { ttyOut: true }
    )
    expect(result.code).toBe(0)
    expect(body?.include).toEqual(['openProfile'])
    expect(body?.audienceId).toBe('aud_1')
    const [header, jane, sam] = result.stdout.split('\n')
    expect(header).toMatch(
      /^EMAIL\s+FIRST\s+LAST\s+SUBSCRIBED\s+OPENS\s+BEST SEND \(UTC\)$/
    )
    expect(jane).toMatch(/jane@example.com\s+Jane\s+true\s+14\s+15:00$/)
    expect(sam).toMatch(/sam@example.com\s+Sam\s+true$/)
  })

  it('refuses a count in --input before sending, and names the count commands', async () => {
    // The SDK's `search` always sends `count: false`, so a count riding
    // --input used to be dropped and the command printed rows as a count.
    let calls = 0
    server.use(
      http.post(`${API}/v1/contacts/search`, () => {
        calls += 1
        return HttpResponse.json({ count: 167 })
      })
    )
    for (const body of [
      '{"count":true}',
      '{"count":true,"groupBy":["emailDomain"]}',
      '{"count":true,"bucket":"month"}',
    ]) {
      const result = await cli(['contacts', 'search', '--input', body])
      expect(result.code, body).toBe(2)
      expect(result.stderr).toContain('contacts count')
      expect(result.stderr).toContain('contacts count-by')
    }
    const withInclude = await cli([
      'contacts',
      'search',
      '--input',
      '{"count":true}',
      '--include',
      'openProfile',
    ])
    expect(withInclude.code).toBe(2)
    expect(calls).toBe(0)
  })

  it('never sends an empty include (the API takes at least one token)', async () => {
    const bodies: Array<Record<string, unknown>> = []
    server.use(
      http.post(`${API}/v1/contacts/search`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json({ data: [], pagination: PAGE_DONE })
      })
    )
    const blankFlag = await cli(['contacts', 'search', '--include', ' , '])
    expect(blankFlag.code).toBe(0)
    const emptyInput = await cli([
      'contacts',
      'search',
      '--input',
      '{"include":[]}',
    ])
    expect(emptyInput.code).toBe(0)
    expect(bodies).toHaveLength(2)
    for (const body of bodies) {
      expect('include' in body).toBe(false)
    }
  })

  it('still searches when --input says count: false', async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.post(`${API}/v1/contacts/search`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: [], pagination: PAGE_DONE })
      })
    )
    const result = await cli([
      'contacts',
      'search',
      '--input',
      '{"count":false,"search":"jane"}',
    ])
    expect(result.code).toBe(0)
    expect(body?.search).toBe('jane')
    expect(body?.count).toBe(false)
  })

  it('sends no include and keeps the plain table without the flag', async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.post(`${API}/v1/contacts/search`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          data: [
            {
              email: 'jane@example.com',
              createdAt: '2026-09-01T00:00:00.000Z',
              updatedAt: '2026-09-01T00:00:00.000Z',
            },
          ],
          pagination: PAGE_DONE,
        })
      })
    )
    const result = await cli(['contacts', 'search', '--search', 'jane'], {
      ttyOut: true,
    })
    expect(result.code).toBe(0)
    expect(body && 'include' in body).toBe(false)
    expect(result.stdout.split('\n')[0]).toMatch(
      /^EMAIL\s+FIRST\s+LAST\s+SUBSCRIBED$/
    )
  })
})
