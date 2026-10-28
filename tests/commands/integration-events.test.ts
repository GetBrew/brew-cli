import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { EnsureIntegrationEventTriggerResponse } from '@brew.new/sdk'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import type { components } from '../../src/generated/openapi-types'
import { server } from '../helpers/msw-server'
import { type RunCliResult, runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const API = 'https://brew.new/api'
const EVENTS = `${API}/v1/integrations/events`
const ENSURE = `${API}/v1/automations/triggers/integration-events`
const EVENT_ID = 'k5714pq3vm8x2n6c9d0b7f1h4j6g2r8t'

function cli(
  argv: readonly string[],
  options: { readonly ttyOut?: boolean } = {}
): Promise<RunCliResult> {
  return runCli(argv, {
    env: {
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
      BREW_API_KEY: KEY,
    },
    ...(options.ttyOut === undefined ? {} : { ttyOut: options.ttyOut }),
  })
}

type EventsPage = components['schemas']['IntegrationEventsListResponse']
type EventRow = EventsPage['data'][number]

const EVENT: EventRow = {
  eventId: EVENT_ID,
  provider: 'posthog',
  sourceId: 'cgr_4f2a9c',
  eventKey: 'created_project',
  title: 'created_project',
  label: 'Created a project',
  kind: 'custom',
  stage: 'activation',
  modelRoles: ['activation', 'key_event'],
  volume30d: 8100,
  lastSeenAt: '2026-10-26T09:12:00.000Z',
}

const SOURCE: EventsPage['sources'][number] = {
  sourceId: 'cgr_4f2a9c',
  provider: 'posthog',
  mode: 'tenant_catalog',
  definitionCount: 214,
  isTruncated: false,
  lastSyncedAt: '2026-10-26T06:00:00.000Z',
}

const DETAIL: components['schemas']['IntegrationEventDetailResponse'] = {
  ...EVENT,
  description: 'A person created a project.',
  properties: [
    {
      key: 'project_name',
      variable: 'properties.project_name',
      scope: 'event',
      type: 'string',
      isPersonal: false,
      isPersonalization: true,
    },
  ],
}

// Typed as the SDK row, which has no `brewEvent` or `skill`.
const TRIGGER: EnsureIntegrationEventTriggerResponse = {
  triggerEventId: 'posthog:org_2abc:brand_9xyz:ev_3f1c9b2e7a4d8c06b5e1f2a3',
  title: 'created_project',
  provider: 'posthog',
  providerEventKey: 'created_project',
  payloadSchema: {
    type: 'object',
    fields: [{ key: 'email', type: 'string', required: true }],
  },
  createdAt: '2026-10-26T12:00:00.000Z',
  updatedAt: '2026-10-26T12:00:00.000Z',
  created: true,
}

function page(
  rows: ReadonlyArray<EventRow>,
  cursor: string | null
): EventsPage {
  return {
    data: [...rows],
    sources: [SOURCE],
    pagination: { limit: 100, cursor, hasMore: cursor !== null },
  }
}

describe('integrations events list', () => {
  it('sends --provider, --query, --kind, --limit and --cursor and prints the page', async () => {
    let params: URLSearchParams | undefined
    server.use(
      http.get(EVENTS, ({ request }) => {
        params = new URL(request.url).searchParams
        return HttpResponse.json(page([EVENT], null))
      })
    )

    const result = await cli([
      'integrations',
      'events',
      'list',
      '--provider',
      'posthog',
      '--query',
      'project',
      '--kind',
      'custom',
      '--limit',
      '20',
      '--cursor',
      'c0',
    ])

    expect(result.code).toBe(0)
    expect(Object.fromEntries(params ?? [])).toEqual({
      provider: 'posthog',
      query: 'project',
      kind: 'custom',
      limit: '20',
      cursor: 'c0',
    })
    expect(result.json).toEqual(page([EVENT], null))
  })

  it('sends no query without flags', async () => {
    let search: string | undefined
    server.use(
      http.get(EVENTS, ({ request }) => {
        search = new URL(request.url).search
        return HttpResponse.json(page([], null))
      })
    )

    const result = await cli(['integrations', 'events', 'list'])

    expect(result.code).toBe(0)
    expect(search).toBe('')
  })

  it('--all follows the cursor through short pages and keeps the sources', async () => {
    const cursors: Array<string | null> = []
    const second = { ...EVENT, eventId: 'k6824qr4wn9y3p7d0e1c8g2j5k7h3s9u' }
    server.use(
      http.get(EVENTS, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        cursors.push(cursor)
        if (cursor === null) {
          return HttpResponse.json(page([EVENT], 'c2'))
        }
        // Hidden events leave a page short, even empty, before the end.
        if (cursor === 'c2') {
          return HttpResponse.json(page([], 'c3'))
        }
        return HttpResponse.json(page([second], null))
      })
    )

    const result = await cli([
      'integrations',
      'events',
      'list',
      '--provider',
      'posthog',
      '--all',
    ])

    expect(result.code).toBe(0)
    expect(cursors).toEqual([null, 'c2', 'c3'])
    expect(result.json).toEqual({
      data: [EVENT, second],
      sources: [SOURCE],
      pagination: { cursor: null, hasMore: false },
    })
  })

  it('reads --input keys as the query', async () => {
    let params: URLSearchParams | undefined
    server.use(
      http.get(EVENTS, ({ request }) => {
        params = new URL(request.url).searchParams
        return HttpResponse.json(page([EVENT], null))
      })
    )

    const result = await cli([
      'integrations',
      'events',
      'list',
      '--input',
      '{"provider":"stripe","kind":"standard"}',
    ])

    expect(result.code).toBe(0)
    expect(Object.fromEntries(params ?? [])).toEqual({
      provider: 'stripe',
      kind: 'standard',
    })
  })

  it('renders a table on a TTY, and says when there are no events', async () => {
    server.use(http.get(EVENTS, () => HttpResponse.json(page([EVENT], null))))
    const table = await cli(['integrations', 'events', 'list'], {
      ttyOut: true,
    })
    expect(table.code).toBe(0)
    const [header, row] = table.stdout.split('\n')
    expect(header).toMatch(/^EVENT ID\s+PROVIDER\s+EVENT\s+LABEL\s+KIND/)
    expect(row).toContain(EVENT_ID)
    expect(row).toContain('Created a project')

    server.use(http.get(EVENTS, () => HttpResponse.json(page([], null))))
    const empty = await cli(['integrations', 'events', 'list'], {
      ttyOut: true,
    })
    expect(empty.stdout.trim()).toBe('No integration events found.')
  })
})

describe('integrations events get', () => {
  it('reads one event by id and prints the bare row', async () => {
    let pathname: string | undefined
    server.use(
      http.get(`${EVENTS}/:eventId`, ({ request }) => {
        pathname = new URL(request.url).pathname
        return HttpResponse.json(DETAIL)
      })
    )

    const result = await cli(['integrations', 'events', 'get', EVENT_ID])

    expect(result.code).toBe(0)
    expect(pathname).toBe(`/api/v1/integrations/events/${EVENT_ID}`)
    expect(result.json).toEqual(DETAIL)
  })

  it('exits 1 with INTEGRATION_EVENT_NOT_FOUND for an unknown or other-brand id', async () => {
    server.use(
      http.get(`${EVENTS}/:eventId`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'INTEGRATION_EVENT_NOT_FOUND',
              type: 'not_found',
              message: 'No live integration event with that id exists.',
              param: 'eventId',
            },
          },
          { status: 404 }
        )
      )
    )

    const result = await cli(['integrations', 'events', 'get', 'evt_missing'])

    expect(result.code).toBe(1)
    expect(JSON.parse(result.stderr)).toMatchObject({
      error: { code: 'INTEGRATION_EVENT_NOT_FOUND' },
    })
  })

  it('needs the eventId', async () => {
    const result = await cli(['integrations', 'events', 'get'])
    expect(result.code).toBe(2)
  })
})

describe('automations triggers ensure-integration-event', () => {
  it('sends the eventId with an idempotency key and prints the row', async () => {
    let body: unknown
    let key: string | null = null
    server.use(
      http.post(ENSURE, async ({ request }) => {
        body = await request.json()
        key = request.headers.get('idempotency-key')
        return HttpResponse.json(TRIGGER, { status: 201 })
      })
    )

    const result = await cli([
      'automations',
      'triggers',
      'ensure-integration-event',
      '--event-id',
      EVENT_ID,
    ])

    expect(result.code).toBe(0)
    expect(body).toEqual({ eventId: EVENT_ID })
    expect(key).toEqual(expect.any(String))
    expect(result.json).toEqual(TRIGGER)
  })

  it('replays with the caller’s --idempotency-key', async () => {
    let key: string | null = null
    server.use(
      http.post(ENSURE, ({ request }) => {
        key = request.headers.get('idempotency-key')
        return HttpResponse.json({ ...TRIGGER, created: false })
      })
    )

    const result = await cli([
      'automations',
      'triggers',
      'ensure-integration-event',
      '--event-id',
      EVENT_ID,
      '--idempotency-key',
      'ensure-created-project',
    ])

    expect(result.code).toBe(0)
    expect(key).toBe('ensure-created-project')
    expect((result.json as { created: boolean }).created).toBe(false)
  })

  it('refuses a missing --event-id as a usage error before any request', async () => {
    let isCalled = false
    server.use(
      http.post(ENSURE, () => {
        isCalled = true
        return HttpResponse.json(TRIGGER, { status: 201 })
      })
    )

    const result = await cli([
      'automations',
      'triggers',
      'ensure-integration-event',
    ])

    expect(result.code).toBe(2)
    expect(result.stderr).toContain('--event-id')
    expect(result.stderr).toContain('integrations events list')
    expect(isCalled).toBe(false)
  })

  it('surfaces 409 TRIGGER_LIMIT_REACHED as the API error with exit 1', async () => {
    server.use(
      http.post(ENSURE, () =>
        HttpResponse.json(
          {
            error: {
              code: 'TRIGGER_LIMIT_REACHED',
              type: 'conflict',
              message:
                'This brand already holds 100 triggers. Delete an unused one, then retry.',
            },
          },
          { status: 409 }
        )
      )
    )

    const result = await cli([
      'automations',
      'triggers',
      'ensure-integration-event',
      '--event-id',
      EVENT_ID,
    ])

    expect(result.code).toBe(1)
    expect(JSON.parse(result.stderr)).toMatchObject({
      error: { code: 'TRIGGER_LIMIT_REACHED' },
    })
  })
})
