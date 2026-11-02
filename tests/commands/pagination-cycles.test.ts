import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const API = 'https://brew.new/api'

function cli(args: readonly string[]) {
  return runCli([...args, '--all', '--quiet'], {
    env: {
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-cycles-')),
      BREW_API_KEY: 'brew_abcdefghijklmnopqrstuvwxyz012345',
      BREW_BRAND_ID: 'kx7b3s7fapqz8mjm12ekz1kxdx87yceg',
    },
  })
}

describe('resumed pagination', () => {
  it.each([
    ['analytics', 'events'],
    ['api-keys', 'list'],
    ['audiences', 'list'],
    ['automations', 'audience-runs', 'list'],
    ['automations', 'list'],
    ['automations', 'runs', 'list'],
    ['automations', 'trigger-instances', 'list'],
    ['automations', 'triggers', 'list'],
    ['brand', 'get-images'],
    ['brands', 'list'],
    ['chats', 'list'],
    ['contacts', 'list'],
    ['contacts', 'search'],
    ['domains', 'list'],
    ['emails', 'comments', 'list', 'em_1'],
    ['emails', 'groups', 'list'],
    ['emails', 'list'],
    ['fields', 'list'],
    ['flows', 'list'],
    ['insights', 'list'],
    ['integrations', 'events', 'list'],
    ['integrations', 'list'],
    ['notifications', 'list'],
    ['sends', 'list'],
    ['contacts', 'list', '--input', '{"cursor":"repeat"}'],
  ])(
    'rejects the starting cursor before refetching it: %s',
    async (...args) => {
      const requested: Array<string | null> = []
      server.use(
        http.all(`${API}/v1/*`, async ({ request }) => {
          const cursor =
            request.method === 'POST'
              ? (((await request.json()) as { cursor?: string }).cursor ?? null)
              : new URL(request.url).searchParams.get('cursor')
          requested.push(cursor)
          return HttpResponse.json({
            data: [],
            // Bound the old walk so a regression cannot hang the test runner.
            pagination: {
              limit: 100,
              cursor: requested.length > 3 ? null : 'repeat',
              hasMore: requested.length <= 3,
            },
          })
        })
      )

      const hasInput = args.includes('--input')
      const result = await cli(
        hasInput ? args : [...args, '--cursor', 'repeat']
      )
      expect(result.code).toBe(1)
      expect(result.stdout).toBe('')
      expect(JSON.parse(result.stderr)).toMatchObject({
        error: {
          code: 'CLI_PAGINATION',
          progress: { rowsFetched: 0, pagesFetched: 1 },
        },
      })
      expect(requested).toEqual(['repeat'])
      expect(
        JSON.parse(result.stderr).error.progress.resumeCursor
      ).toBeUndefined()
    }
  )
})

describe('comment-thread pagination', () => {
  it.each([
    { start: undefined, cursors: ['a', 'a'] },
    { start: undefined, cursors: ['a', 'b', 'a'] },
    { start: 'a', cursors: ['a'] },
  ])(
    'rejects cyclic message slices without printing a partial thread',
    async ({ start, cursors }) => {
      const requested: Array<string | null> = []
      server.use(
        http.get(`${API}/v1/emails/em_1/comments`, ({ request }) => {
          requested.push(
            new URL(request.url).searchParams.get('messagesCursor')
          )
          return HttpResponse.json({
            data: [
              {
                commentId: 'cmt_1',
                emailId: 'em_1',
                target: { kind: 'email' },
                messageCount: 3,
                url: 'https://brew.new/emails/em_1?comment=cmt_1',
                messages: [
                  {
                    messageId: `message_${requested.length}`,
                    author: { userId: 'usr_1', name: 'Jane Doe' },
                    body: 'A comment',
                    createdAt: '2026-10-02T09:00:00.000Z',
                  },
                ],
                messagesCursor: cursors[requested.length - 1] ?? null,
              },
            ],
            pagination: { limit: 100, cursor: null, hasMore: false },
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
        ...(start === undefined ? [] : ['--messages-cursor', start]),
      ])
      expect(result.code).toBe(1)
      expect(result.stdout).toBe('')
      expect(JSON.parse(result.stderr)).toMatchObject({
        error: {
          code: 'CLI_PAGINATION',
          progress: {
            rowsFetched: cursors.length,
            pagesFetched: cursors.length,
          },
        },
      })
      expect(requested).toEqual([start ?? null, ...cursors.slice(0, -1)])
      expect(
        JSON.parse(result.stderr).error.progress.resumeCursor
      ).toBeUndefined()
      expect(
        JSON.parse(result.stderr).error.progress.resumeWith
      ).toBeUndefined()
    }
  )
})
