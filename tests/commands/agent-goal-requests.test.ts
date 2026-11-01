import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import type { operations } from '../../src/generated/openapi-types'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const env = { BREW_API_KEY: 'brew_cli_test', BREW_BRAND_ID: 'brand_1' }
const base = 'https://brew.new/api/v1/agent-goals'
const timestamp = '2026-10-28T00:00:00.000Z'
const goalInput = {
  name: 'Improve activation',
  objective: 'Run an ongoing activation campaign',
  audienceId: 'audience_engaged',
  cadence: { intervalDays: 7, timeZone: 'America/New_York' },
  planningHorizonDays: 28,
  successMetric: 'Activated accounts',
  budget: {
    maxRecipients: 1000,
    maxSpendCredits: 100,
    maxCampaigns: 4,
    periodDays: 28,
  },
  chatId: 'chat_existing',
} satisfies operations['createAgentGoal']['requestBody']['content']['application/json']
const goal = {
  ...goalInput,
  goalId: 'goal_1',
  status: 'paused' as const,
  createdAt: timestamp,
  updatedAt: timestamp,
}

function expectRead(request: Request, path: string, brand = 'brand_1') {
  expect(request.method).toBe('GET')
  expect(new URL(request.url).pathname).toBe(`/api/v1/agent-goals/${path}`)
  expect(request.headers.get('authorization')).toBe('Bearer brew_cli_test')
  expect(request.headers.get('x-brand-id')).toBe(brand)
  expect(request.body).toBeNull()
}

describe('agent-goals request contracts', () => {
  it('creates a goal with the complete JSON body, brand scope and replay identity', async () => {
    let requests = 0
    server.use(
      http.post(base, async ({ request }) => {
        requests += 1
        expect(request.url).toBe(base)
        expect(request.headers.get('authorization')).toBe(
          'Bearer brew_cli_test'
        )
        expect(request.headers.get('x-brand-id')).toBe('brand_1')
        expect(request.headers.get('content-type')).toBe('application/json')
        expect(request.headers.get('idempotency-key')).toBe('create-goal-once')
        expect(await request.json()).toEqual(goalInput)
        return HttpResponse.json(goal, { status: 201 })
      })
    )
    const result = await runCli(
      [
        'agent-goals',
        'create',
        '--input',
        '-',
        '--idempotency-key',
        'create-goal-once',
      ],
      { env, stdin: JSON.stringify(goalInput) }
    )
    expect(result.code).toBe(0)
    expect(result.json).toEqual(goal)
    expect(requests).toBe(1)
  })

  it('reads the exact goal detail URL using the selected brand without a request body', async () => {
    const detail = {
      goal,
      grant: null,
      executions: [],
      files: [
        {
          path: 'plans/campaign.md',
          revision: 2,
          sizeBytes: 14,
          updatedAt: timestamp,
        },
      ],
      updates: [],
      approvals: [],
    } satisfies operations['getAgentGoal']['responses'][200]['content']['application/json']
    let requests = 0
    server.use(
      http.get(`${base}/:goalId`, ({ request }) => {
        requests += 1
        expectRead(request, 'goal_1', 'brand_selected')
        expect(new URL(request.url).search).toBe('')
        return HttpResponse.json(detail)
      })
    )
    const result = await runCli(
      ['agent-goals', 'get', 'goal_1', '--brand', 'brand_selected'],
      { env }
    )
    expect(result.code).toBe(0)
    expect(result.json).toEqual(detail)
    expect(requests).toBe(1)
  })

  it('walks task pages from the supplied cursor and forwards the same limit on every GET', async () => {
    const cursors: Array<string | null> = []
    const task = (executionId: string) => ({
      executionId,
      status: 'completed',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    server.use(
      http.get(`${base}/:goalId/tasks`, ({ request }) => {
        expectRead(request, 'goal_1/tasks')
        const params = new URL(request.url).searchParams
        const cursor = params.get('cursor')
        expect(params.get('limit')).toBe('2')
        expect(cursor).toBe(cursors.length === 0 ? 'resume_here' : 'next_page')
        cursors.push(cursor)
        return HttpResponse.json({
          data: [
            task(cursor === 'resume_here' ? 'execution_1' : 'execution_2'),
          ],
          pagination: {
            cursor: cursor === 'resume_here' ? 'next_page' : null,
            hasMore: cursor === 'resume_here',
            limit: 2,
          },
        })
      })
    )
    const result = await runCli(
      [
        'agent-goals',
        'tasks',
        'goal_1',
        '--all',
        '--cursor',
        'resume_here',
        '--limit',
        '2',
      ],
      { env }
    )
    expect(result.code).toBe(0)
    expect(result.json).toEqual({
      data: [task('execution_1'), task('execution_2')],
      pagination: { cursor: null, hasMore: false },
    })
    expect(cursors).toEqual(['resume_here', 'next_page'])
  })

  it.each([
    { mode: 'server default', flags: [], limit: null },
    { mode: 'explicit maximum', flags: ['--limit', '25'], limit: '25' },
  ])(
    'reads complete documents at the $mode page size',
    async ({ flags, limit }) => {
      const content = '# Next campaign\n검증된 결과를 측정합니다.'
      const document = {
        path: 'plans/campaign.md',
        revision: 2,
        content,
        sizeBytes: Buffer.byteLength(content),
        source: 'send_1',
        updatedAt: timestamp,
      }
      const response = {
        data: [document],
        pagination: { cursor: null, hasMore: false, limit: 25 },
      }
      let requests = 0
      server.use(
        http.get(`${base}/:goalId/documents`, ({ request }) => {
          requests += 1
          expectRead(request, 'goal_1/documents')
          const params = new URL(request.url).searchParams
          expect(params.get('limit')).toBe(limit)
          expect(params.get('cursor')).toBeNull()
          return HttpResponse.json(response)
        })
      )
      const result = await runCli(
        ['agent-goals', 'documents', 'goal_1', ...flags],
        { env }
      )
      expect(result.code).toBe(0)
      expect(result.json).toEqual(response)
      expect(requests).toBe(1)
    }
  )

  it('preserves the API rejection when a document page exceeds the server limit', async () => {
    let requests = 0
    server.use(
      http.get(`${base}/:goalId/documents`, ({ request }) => {
        requests += 1
        expectRead(request, 'goal_1/documents')
        expect(new URL(request.url).searchParams.get('limit')).toBe('26')
        return HttpResponse.json(
          {
            error: {
              code: 'INVALID_REQUEST',
              type: 'invalid_request',
              message: 'Document pages are limited to 25 files.',
              param: 'limit',
            },
          },
          { status: 400, headers: { 'x-request-id': 'request_document_limit' } }
        )
      })
    )
    const result = await runCli(
      ['agent-goals', 'documents', 'goal_1', '--limit', '26'],
      { env }
    )
    expect(result.code).toBe(1)
    expect(result.stdout).toBe('')
    expect(JSON.parse(result.stderr)).toMatchObject({
      error: {
        code: 'INVALID_REQUEST',
        param: 'limit',
        requestId: 'request_document_limit',
      },
    })
    expect(requests).toBe(1)
  })
})
