import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const env = { BREW_API_KEY: 'brew_cli_test', BREW_BRAND_ID: 'brand_1' }
const base = 'https://brew.new/api/v1/agent-goals'

describe('agent-goals commands', () => {
  it('lists all pages with brand scope and preserves JSON output', async () => {
    let requests = 0
    server.use(
      http.get(base, ({ request }) => {
        requests += 1
        expect(request.headers.get('x-brand-id')).toBe('brand_1')
        const cursor = new URL(request.url).searchParams.get('cursor')
        return HttpResponse.json({
          data: [{ goalId: cursor === null ? 'goal_1' : 'goal_2' }],
          pagination: {
            cursor: cursor === null ? 'next' : null,
            hasMore: cursor === null,
            limit: 1,
          },
        })
      })
    )
    const result = await runCli(
      ['agent-goals', 'list', '--all', '--limit', '1'],
      { env }
    )
    expect(result.code).toBe(0)
    expect(result.json).toMatchObject({
      data: [{ goalId: 'goal_1' }, { goalId: 'goal_2' }],
    })
    expect(requests).toBe(2)
  })

  it('publishes a document using an expected revision and stable replay key', async () => {
    let body: unknown
    let idempotencyKey: string | null = null
    server.use(
      http.post(`${base}/:goalId/documents`, async ({ request }) => {
        body = await request.json()
        idempotencyKey = request.headers.get('idempotency-key')
        return HttpResponse.json({
          goalId: 'goal_1',
          path: 'plan.md',
          revision: 3,
        })
      })
    )
    const result = await runCli(
      [
        'agent-goals',
        'publish-document',
        'goal_1',
        '--path',
        'plan.md',
        '--expected-revision',
        '2',
        '--file',
        '-',
        '--idempotency-key',
        'publish_1',
      ],
      { env, stdin: 'Next campaign plan' }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({
      path: 'plan.md',
      expectedRevision: 2,
      content: 'Next campaign plan',
    })
    expect(idempotencyKey).toBe('publish_1')
  })

  it('requires confirmation before changing a goal lifecycle', async () => {
    const refused = await runCli(
      ['agent-goals', 'update', 'goal_1', '--status', 'cancelled'],
      { env }
    )
    expect(refused.code).toBe(4)
    server.use(
      http.patch(`${base}/:goalId`, async ({ request }) => {
        expect(await request.json()).toEqual({ status: 'cancelled' })
        return HttpResponse.json({ goalId: 'goal_1', status: 'cancelled' })
      })
    )
    const result = await runCli(
      ['agent-goals', 'update', 'goal_1', '--status', 'cancelled', '--yes'],
      { env }
    )
    expect(result.code).toBe(0)
  })

  it('rejects two stdin consumers before reading or publishing a blank document', async () => {
    let reads = 0
    let requests = 0
    server.use(
      http.post(`${base}/:goalId/documents`, () => {
        requests++
        return HttpResponse.json({ revision: 3 })
      })
    )
    const result = await runCli(
      [
        'agent-goals',
        'publish-document',
        'goal_1',
        '--input',
        '-',
        '--file',
        '-',
      ],
      {
        env,
        readStdin: async () => {
          reads++
          return reads === 1
            ? JSON.stringify({
                path: 'plan.md',
                expectedRevision: 2,
                content: 'Keep this plan',
              })
            : ''
        },
      }
    )
    expect({ code: result.code, reads, requests }).toEqual({
      code: 2,
      reads: 0,
      requests: 0,
    })
    expect(result.stderr).toContain(
      'Only one of --input and --file can read stdin.'
    )
  })

  it('preserves inline JSON metadata when only document content uses stdin', async () => {
    let reads = 0
    server.use(
      http.post(`${base}/:goalId/documents`, async ({ request }) => {
        expect(await request.json()).toEqual({
          path: 'plan.md',
          expectedRevision: 2,
          content: 'File contents',
          source: 'brief:one',
        })
        return HttpResponse.json({ revision: 3 })
      })
    )
    const result = await runCli(
      [
        'agent-goals',
        'publish-document',
        'goal_1',
        '--input',
        JSON.stringify({
          path: 'plan.md',
          expectedRevision: 2,
          content: 'Old JSON contents',
          source: 'brief:one',
        }),
        '--file',
        '-',
      ],
      {
        env,
        readStdin: async () => {
          reads++
          return 'File contents'
        },
      }
    )
    expect(result.code).toBe(0)
    expect(reads).toBe(1)
  })

  it('preserves JSON stdin when document content comes from a file', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'brew-goal-document-'))
    const path = join(directory, 'plan.md')
    writeFileSync(path, 'File contents')
    let reads = 0
    server.use(
      http.post(`${base}/:goalId/documents`, async ({ request }) => {
        expect(await request.json()).toEqual({
          path: 'plan.md',
          expectedRevision: 2,
          content: 'File contents',
        })
        return HttpResponse.json({ revision: 3 })
      })
    )
    try {
      const result = await runCli(
        [
          'agent-goals',
          'publish-document',
          'goal_1',
          '--input',
          '-',
          '--file',
          path,
        ],
        {
          env,
          readStdin: async () => {
            reads++
            return JSON.stringify({ path: 'plan.md', expectedRevision: 2 })
          },
        }
      )
      expect(result.code).toBe(0)
      expect(reads).toBe(1)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('merges planning horizon and chat flags over a complete create body', async () => {
    const input = {
      name: 'Activation',
      objective: 'Grow qualified activation',
      audienceId: 'audience_1',
      successMetric: 'Activated accounts',
      planningHorizonDays: 14,
      chatId: 'chat_original',
      cadence: { intervalDays: 7, timeZone: 'UTC' },
      budget: {
        maxRecipients: 1000,
        maxSpendCredits: 100,
        maxCampaigns: 4,
        periodDays: 28,
      },
    }
    server.use(
      http.post(base, async ({ request }) => {
        expect(request.headers.get('x-brand-id')).toBe('brand_1')
        expect(request.headers.get('idempotency-key')).toBe('create_1')
        expect(await request.json()).toEqual({
          ...input,
          planningHorizonDays: 28,
          chatId: 'chat_updated',
        })
        return HttpResponse.json(
          { goalId: 'goal_1', status: 'paused' },
          { status: 201 }
        )
      })
    )
    const result = await runCli(
      [
        'agent-goals',
        'create',
        '--input',
        JSON.stringify(input),
        '--planning-horizon-days',
        '28',
        '--chat-id',
        'chat_updated',
        '--idempotency-key',
        'create_1',
      ],
      { env }
    )
    expect(result.code).toBe(0)
    expect(result.json).toEqual({ goalId: 'goal_1', status: 'paused' })
  })

  it('creates a published document with revision zero', async () => {
    server.use(
      http.post(`${base}/:goalId/documents`, async ({ request }) => {
        expect(await request.json()).toEqual({
          path: 'plan.md',
          expectedRevision: 0,
          content: 'First campaign plan',
        })
        return HttpResponse.json({
          goalId: 'goal_1',
          path: 'plan.md',
          revision: 1,
        })
      })
    )
    const result = await runCli(
      [
        'agent-goals',
        'publish-document',
        'goal_1',
        '--path',
        'plan.md',
        '--expected-revision',
        '0',
        '--file',
        '-',
      ],
      { env, stdin: 'First campaign plan' }
    )
    expect(result.code).toBe(0)
    expect(result.json).toMatchObject({ revision: 1 })
  })

  it.each(['-1', '0.5', '', '9007199254740992'])(
    'rejects invalid document revision %j before publishing',
    async (revision) => {
      const result = await runCli(
        [
          'agent-goals',
          'publish-document',
          'goal_1',
          '--path',
          'plan.md',
          '--expected-revision',
          revision,
          '--file',
          '-',
        ],
        { env, stdin: 'Campaign plan' }
      )
      expect(result.code).toBe(2)
    }
  )

  it('schedules a follow-up without granting additional authority', async () => {
    server.use(
      http.post(`${base}/:goalId/follow-ups`, async ({ request }) => {
        expect(await request.json()).toEqual({
          message: 'Review results',
          sourceId: 'send_1:review',
          dueAt: 1793404800000,
        })
        return HttpResponse.json({ goalId: 'goal_1', wakeId: 'wake_1' })
      })
    )
    const result = await runCli(
      [
        'agent-goals',
        'follow-up',
        'goal_1',
        '--message',
        'Review results',
        '--source-id',
        'send_1:review',
        '--due-at',
        '1793404800000',
      ],
      { env }
    )
    expect(result.code).toBe(0)
    expect(result.json).toEqual({ goalId: 'goal_1', wakeId: 'wake_1' })
  })
})
