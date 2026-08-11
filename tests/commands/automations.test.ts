import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { automationsCreateCommand } from '../../src/commands/automations/create'
import { automationsDeleteCommand } from '../../src/commands/automations/delete'
import { automationsGetCommand } from '../../src/commands/automations/get'
import { automationsListCommand } from '../../src/commands/automations/list'
import { automationsPublishCommand } from '../../src/commands/automations/publish'
import { automationsRunsListCommand } from '../../src/commands/automations/runs/list'
import { automationsTestCommand } from '../../src/commands/automations/test'
import { automationsTriggersCreateCommand } from '../../src/commands/automations/triggers/create'
import { automationsTriggersDeleteCommand } from '../../src/commands/automations/triggers/delete'
import { automationsTriggersFireCommand } from '../../src/commands/automations/triggers/fire'
import { automationsTriggersListCommand } from '../../src/commands/automations/triggers/list'
import { automationsTriggersUpdateCommand } from '../../src/commands/automations/triggers/update'
import { automationsUnpublishCommand } from '../../src/commands/automations/unpublish'
import { automationsUpdateCommand } from '../../src/commands/automations/update'
import { server } from '../helpers/msw-server'
import { type RunCliResult, runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'

const EXTRA = [
  automationsListCommand,
  automationsGetCommand,
  automationsCreateCommand,
  automationsUpdateCommand,
  automationsPublishCommand,
  automationsUnpublishCommand,
  automationsDeleteCommand,
  automationsTestCommand,
  automationsTriggersListCommand,
  automationsTriggersCreateCommand,
  automationsTriggersUpdateCommand,
  automationsTriggersDeleteCommand,
  automationsTriggersFireCommand,
  automationsRunsListCommand,
]

function cli(argv: readonly string[]): Promise<RunCliResult> {
  return runCli(argv, {
    env: {
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
      BREW_API_KEY: KEY,
    },
    extraCommands: EXTRA,
  })
}

const API = 'https://brew.new/api'
const PAGE_DONE = { limit: 100, cursor: null, hasMore: false }

describe('automations list', () => {
  it('lists automations with a limit', async () => {
    let query: URLSearchParams | undefined
    server.use(
      http.get(`${API}/v1/automations`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json({
          data: [{ automationId: 'am_1', name: 'Welcome', published: true }],
          pagination: PAGE_DONE,
        })
      })
    )
    const result = await cli(['automations', 'list', '--limit', '5'])
    expect(result.code).toBe(0)
    expect(query?.get('limit')).toBe('5')
    const data = result.json as { data: Array<{ automationId: string }> }
    expect(data.data[0]?.automationId).toBe('am_1')
  })
})

describe('automations get (derived)', () => {
  it('fetches one automation with --include', async () => {
    let query: URLSearchParams | undefined
    server.use(
      http.get(`${API}/v1/automations`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json({
          data: [{ automationId: 'am_1', name: 'Welcome', nodes: [] }],
        })
      })
    )
    const result = await cli([
      'automations',
      'get',
      'am_1',
      '--include',
      'graph',
    ])
    expect(result.code).toBe(0)
    expect(query?.get('automationId')).toBe('am_1')
    expect(query?.get('include')).toBe('graph')
    expect((result.json as { automationId: string }).automationId).toBe('am_1')
  })

  it('exits 1 with AUTOMATION_NOT_FOUND when missing', async () => {
    server.use(
      http.get(`${API}/v1/automations`, () => HttpResponse.json({ data: [] }))
    )
    const result = await cli(['automations', 'get', 'am_ghost'])
    expect(result.code).toBe(1)
    const parsed = JSON.parse(result.stderr) as { error: { code: string } }
    expect(parsed.error.code).toBe('AUTOMATION_NOT_FOUND')
  })
})

describe('automations create', () => {
  it('requires --input for the graph', async () => {
    const result = await cli(['automations', 'create', '--name', 'Welcome'])
    expect(result.code).toBe(2)
  })

  it('merges scalar flags over the graph body', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/automations`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ automationId: 'am_1' }, { status: 201 })
      })
    )
    const result = await cli([
      'automations',
      'create',
      '--name',
      'Welcome',
      '--input',
      '{"triggerEventId":"tev_1","nodes":[],"connections":[]}',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({
      name: 'Welcome',
      triggerEventId: 'tev_1',
      nodes: [],
      connections: [],
    })
  })
})

describe('automations update', () => {
  it('PATCHes metadata onto the automation', async () => {
    let body: unknown
    server.use(
      http.patch(`${API}/v1/automations/am_1`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ automationId: 'am_1', name: 'Renamed' })
      })
    )
    const result = await cli([
      'automations',
      'update',
      'am_1',
      '--name',
      'Renamed',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({ name: 'Renamed' })
  })

  it('rejects an empty update', async () => {
    const result = await cli(['automations', 'update', 'am_1'])
    expect(result.code).toBe(2)
  })
})

describe('automations publish/unpublish', () => {
  it('publish sends { published: true }', async () => {
    let body: unknown
    server.use(
      http.patch(`${API}/v1/automations/am_1`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ automationId: 'am_1', published: true })
      })
    )
    const result = await cli(['automations', 'publish', 'am_1'])
    expect(result.code).toBe(0)
    expect(body).toEqual({ published: true })
  })

  it('publish pins a version when asked', async () => {
    let body: unknown
    server.use(
      http.patch(`${API}/v1/automations/am_1`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ automationId: 'am_1', published: true })
      })
    )
    const result = await cli([
      'automations',
      'publish',
      'am_1',
      '--automation-version',
      'amv_2',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({ published: true, automationVersionId: 'amv_2' })
  })

  it('unpublish sends { published: false }', async () => {
    let body: unknown
    server.use(
      http.patch(`${API}/v1/automations/am_1`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ automationId: 'am_1', published: false })
      })
    )
    const result = await cli(['automations', 'unpublish', 'am_1'])
    expect(result.code).toBe(0)
    expect(body).toEqual({ published: false })
  })
})

describe('automations delete (confirmation protocol)', () => {
  it('exits 4 with an envelope when unconfirmed', async () => {
    const result = await cli(['automations', 'delete', 'am_1'])
    expect(result.code).toBe(4)
    const envelope = result.json as Record<string, unknown>
    expect(envelope.confirmationRequired).toBe(true)
    expect(envelope.confirmCommand).toBe(
      'brew-cli automations delete am_1 --yes'
    )
  })

  it('deletes with --yes', async () => {
    server.use(
      http.delete(`${API}/v1/automations/am_1`, () =>
        HttpResponse.json({ automationId: 'am_1', deleted: true })
      )
    )
    const result = await cli(['automations', 'delete', 'am_1', '--yes'])
    expect(result.code).toBe(0)
    expect((result.json as { deleted: boolean }).deleted).toBe(true)
  })
})

describe('automations test', () => {
  it('wraps a bare object into the { payload } envelope', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/automations/am_1/test`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          automationRunIds: ['arun_1'],
          status: 'test_started',
        })
      })
    )
    const result = await cli([
      'automations',
      'test',
      'am_1',
      '--input',
      '{"userId":"u_1"}',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({ payload: { userId: 'u_1' } })
  })
})

describe('automations triggers list', () => {
  it('lists trigger events', async () => {
    server.use(
      http.get(`${API}/v1/automations/triggers`, () =>
        HttpResponse.json({
          data: [{ triggerEventId: 'tev_1', title: 'user.signup' }],
          pagination: PAGE_DONE,
        })
      )
    )
    const result = await cli(['automations', 'triggers', 'list'])
    expect(result.code).toBe(0)
    const data = result.json as { data: Array<{ triggerEventId: string }> }
    expect(data.data[0]?.triggerEventId).toBe('tev_1')
  })
})

describe('automations triggers create', () => {
  it('requires a title', async () => {
    const result = await cli([
      'automations',
      'triggers',
      'create',
      '--input',
      '{"payloadSchema":{"type":"object","fields":[]}}',
    ])
    expect(result.code).toBe(2)
  })

  it('sends the title and payload schema', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/automations/triggers`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ triggerEventId: 'tev_1' }, { status: 201 })
      })
    )
    const result = await cli([
      'automations',
      'triggers',
      'create',
      '--title',
      'user.signup',
      '--input',
      '{"payloadSchema":{"type":"object","fields":[{"key":"userId","type":"string","required":true}]}}',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({
      title: 'user.signup',
      payloadSchema: {
        type: 'object',
        fields: [{ key: 'userId', type: 'string', required: true }],
      },
    })
  })
})

describe('automations triggers update', () => {
  it('PATCHes the trigger event', async () => {
    let body: unknown
    server.use(
      http.patch(
        `${API}/v1/automations/triggers/tev_1`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ triggerEventId: 'tev_1' })
        }
      )
    )
    const result = await cli([
      'automations',
      'triggers',
      'update',
      'tev_1',
      '--title',
      'user.signup.v2',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({ title: 'user.signup.v2' })
  })
})

describe('automations triggers delete (confirmation protocol)', () => {
  it('exits 4 when unconfirmed', async () => {
    const result = await cli(['automations', 'triggers', 'delete', 'tev_1'])
    expect(result.code).toBe(4)
    expect(
      (result.json as { confirmationRequired: boolean }).confirmationRequired
    ).toBe(true)
  })

  it('deletes with --yes', async () => {
    server.use(
      http.delete(`${API}/v1/automations/triggers/tev_1`, () =>
        HttpResponse.json({ triggerEventId: 'tev_1', deleted: true })
      )
    )
    const result = await cli([
      'automations',
      'triggers',
      'delete',
      'tev_1',
      '--yes',
    ])
    expect(result.code).toBe(0)
    expect((result.json as { deleted: boolean }).deleted).toBe(true)
  })
})

describe('automations triggers fire (confirmation protocol)', () => {
  it('exits 4 and warns about REAL runs when unconfirmed', async () => {
    const result = await cli([
      'automations',
      'triggers',
      'fire',
      'tev_1',
      '--input',
      '{"payload":{"userId":"u_1"}}',
    ])
    expect(result.code).toBe(4)
    expect((result.json as { summary: string }).summary).toContain('REAL runs')
  })

  it('requires a payload --input', async () => {
    const result = await cli([
      'automations',
      'triggers',
      'fire',
      'tev_1',
      '--yes',
    ])
    expect(result.code).toBe(2)
  })

  it('fires the trigger with the JSON payload when confirmed', async () => {
    let body: unknown
    server.use(
      http.post(
        `${API}/v1/automations/triggers/tev_1/fire`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ success: true, status: 'triggered' })
        }
      )
    )
    const result = await cli([
      'automations',
      'triggers',
      'fire',
      'tev_1',
      '--input',
      '{"payload":{"userId":"u_1"}}',
      '--yes',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({ payload: { userId: 'u_1' } })
  })

  it('wraps a bare object into the { payload } envelope', async () => {
    let body: unknown
    server.use(
      http.post(
        `${API}/v1/automations/triggers/tev_1/fire`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ success: true, status: 'triggered' })
        }
      )
    )
    const result = await cli([
      'automations',
      'triggers',
      'fire',
      'tev_1',
      '--input',
      '{"userId":"u_1"}',
      '--yes',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({ payload: { userId: 'u_1' } })
  })
})

describe('automations runs list', () => {
  it('maps filter flags onto query params', async () => {
    let query: URLSearchParams | undefined
    server.use(
      http.get(`${API}/v1/automations/runs`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json({
          data: [{ automationRunId: 'arun_1', status: 'failed' }],
          pagination: PAGE_DONE,
        })
      })
    )
    const result = await cli([
      'automations',
      'runs',
      'list',
      '--status',
      'failed',
      '--mode',
      'test',
      '--since',
      '2026-08-01',
      '--until',
      '2026-08-10',
    ])
    expect(result.code).toBe(0)
    expect(query?.get('status')).toBe('failed')
    expect(query?.get('mode')).toBe('test')
    expect(query?.get('from')).toBe('2026-08-01')
    expect(query?.get('to')).toBe('2026-08-10')
  })
})
