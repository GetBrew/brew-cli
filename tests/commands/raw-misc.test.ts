import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { analyticsOverviewCommand } from '../../src/commands/analytics/overview'
import { audiencesDuplicateCommand } from '../../src/commands/audiences/duplicate'
import { audiencesFromEventsCommand } from '../../src/commands/audiences/from-events'
import { automationsAudienceRunsControlCommand } from '../../src/commands/automations/audience-runs/control'
import { automationsAudienceRunsListCommand } from '../../src/commands/automations/audience-runs/list'
import { automationsRunCommand } from '../../src/commands/automations/run'
import { brandsCreateCommand } from '../../src/commands/brands/create'
import { brandsGetCommand } from '../../src/commands/brands/get'
import { brandsListCommand } from '../../src/commands/brands/list'
import { chatsGetCommand } from '../../src/commands/chats/get'
import { domainsHealthCommand } from '../../src/commands/domains/health'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'

const EXTRA = [
  analyticsOverviewCommand,
  brandsListCommand,
  brandsGetCommand,
  brandsCreateCommand,
  chatsGetCommand,
  audiencesDuplicateCommand,
  audiencesFromEventsCommand,
  automationsRunCommand,
  automationsAudienceRunsListCommand,
  automationsAudienceRunsControlCommand,
  domainsHealthCommand,
]

function env(): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    BREW_API_KEY: KEY,
  }
}

const API = 'https://brew.new/api'

describe('analytics overview', () => {
  it('maps flags onto the spec query parameters', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/analytics/overview`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          totals: { sent: 5000 },
          rates: { openRate: 0.42 },
          buckets: [],
          granularity: '1d',
          timeZone: 'UTC',
          range: { from: 'a', to: 'b' },
          truncated: false,
        })
      })
    )
    const result = await runCli(
      [
        'analytics',
        'overview',
        '--since',
        '2026-08-01T00:00:00Z',
        '--until',
        '2026-08-08T00:00:00Z',
        '--source',
        'audience,api',
        '--automation-id',
        'auto_1,auto_2',
        '--recipient',
        '@clay.com,!ceo@clay.com',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('from')).toBe('2026-08-01T00:00:00Z')
    expect(url?.searchParams.get('to')).toBe('2026-08-08T00:00:00Z')
    expect(url?.searchParams.get('source')).toBe('audience,api')
    expect(url?.searchParams.get('automationId')).toBe('auto_1,auto_2')
    expect(url?.searchParams.get('recipient')).toBe('@clay.com,!ceo@clay.com')
    expect(url?.searchParams.has('emailId')).toBe(false)
    expect((result.json as { truncated: boolean }).truncated).toBe(false)
  })
})

describe('brands', () => {
  it('lists brands', async () => {
    server.use(
      http.get(`${API}/v1/brands`, () =>
        HttpResponse.json({
          data: [{ brandId: 'kxbrand1', domain: 'acme.com', ready: true }],
          pagination: { limit: 100, cursor: null, hasMore: false },
        })
      )
    )
    const result = await runCli(['brands', 'list'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    const data = result.json as { data: Array<{ brandId: string }> }
    expect(data.data[0]?.brandId).toBe('kxbrand1')
  })

  it('gets one brand by id', async () => {
    server.use(
      http.get(`${API}/v1/brands/kxbrand1`, () =>
        HttpResponse.json({
          brandId: 'kxbrand1',
          status: 'extracting',
          progress: 40,
        })
      )
    )
    const result = await runCli(['brands', 'get', 'kxbrand1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect((result.json as { status: string }).status).toBe('extracting')
  })

  it('creates a brand from --url and --instructions', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/brands`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          {
            brand: { brandId: 'kxbrand2', status: 'extracting' },
            extraction: { chatId: 'chat_9', statusUrl: '/v1/brands/kxbrand2' },
          },
          { status: 201 }
        )
      })
    )
    const result = await runCli(
      [
        'brands',
        'create',
        '--url',
        'acme.com',
        '--instructions',
        'Primary color is navy',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({
      url: 'acme.com',
      instructions: 'Primary color is navy',
    })
  })

  it('requires --url on create', async () => {
    const result = await runCli(['brands', 'create'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(2)
  })
})

describe('chats get', () => {
  it('fetches the chat context digest', async () => {
    server.use(
      http.get(`${API}/v1/chats/Hk2mZ8t9`, () =>
        HttpResponse.json({
          chatId: 'Hk2mZ8t9',
          messageCount: 18,
          artifacts: [],
        })
      )
    )
    const result = await runCli(['chats', 'get', 'Hk2mZ8t9'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect((result.json as { messageCount: number }).messageCount).toBe(18)
  })
})

describe('audiences duplicate', () => {
  it('POSTs with no request body', async () => {
    let text: string | undefined
    server.use(
      http.post(`${API}/v1/audiences/aud_1/duplicate`, async ({ request }) => {
        text = await request.text()
        return HttpResponse.json(
          { audienceId: 'aud_2', audienceName: 'Nordic Founders (copy)' },
          { status: 201 }
        )
      })
    )
    const result = await runCli(['audiences', 'duplicate', 'aud_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect(text).toBe('')
    expect((result.json as { audienceId: string }).audienceId).toBe('aud_2')
  })
})

describe('audiences from-events', () => {
  it('rejects a call without the required cohort fields (exit 2)', async () => {
    const result = await runCli(
      ['audiences', 'from-events', '--since', '2026-07-01T00:00:00Z'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('--event-types')
  })

  it('builds the cohort body from flags', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/audiences/from-events`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          {
            audienceId: 'aud_9',
            materializationStatus: 'pending',
          },
          { status: 201 }
        )
      })
    )
    const result = await runCli(
      [
        'audiences',
        'from-events',
        '--name',
        'Opened in July',
        '--event-types',
        'opened',
        'clicked',
        '--since',
        '2026-07-01T00:00:00Z',
        '--until',
        '2026-08-01T00:00:00Z',
        '--email-id',
        'eml_1',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({
      name: 'Opened in July',
      cohort: {
        eventTypes: ['opened', 'clicked'],
        from: '2026-07-01T00:00:00Z',
        to: '2026-08-01T00:00:00Z',
        emailId: 'eml_1',
      },
    })
  })
})

describe('automations run (confirmation protocol)', () => {
  it('runs a dry run without a gate and pins the body', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/automations/auto_1/run`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          dry_run: true,
          automationId: 'auto_1',
          recipientCount: 12_400,
        })
      })
    )
    const result = await runCli(['automations', 'run', 'auto_1', '--dry-run'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect(body).toEqual({ dry_run: true })
    expect((result.json as { recipientCount: number }).recipientCount).toBe(
      12_400
    )
  })

  it('honors dry_run carried inside --input (no gate)', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/automations/auto_1/run`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ dry_run: true, automationId: 'auto_1' })
      })
    )
    const result = await runCli(
      ['automations', 'run', 'auto_1', '--input', '{"dry_run":true}'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ dry_run: true })
  })

  it('gates a live run with exit 4 when unconfirmed', async () => {
    const result = await runCli(['automations', 'run', 'auto_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(4)
    const envelope = result.json as Record<string, unknown>
    expect(envelope.confirmationRequired).toBe(true)
    expect(envelope.confirmCommand).toBe(
      'brew-cli automations run auto_1 --yes'
    )
  })
})

describe('automations audience-runs', () => {
  it('lists runs with the spec query parameters', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/automations/audience-runs`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          data: [{ audienceRunId: 'arun_1', status: 'sending' }],
        })
      })
    )
    const result = await runCli(
      [
        'automations',
        'audience-runs',
        'list',
        '--automation-id',
        'auto_1',
        '--limit',
        '20',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('automationId')).toBe('auto_1')
    expect(url?.searchParams.get('limit')).toBe('20')
    const data = result.json as { data: Array<{ audienceRunId: string }> }
    expect(data.data[0]?.audienceRunId).toBe('arun_1')
  })

  it('gates control --action cancel behind confirmation', async () => {
    const result = await runCli(
      [
        'automations',
        'audience-runs',
        'control',
        'arun_1',
        '--action',
        'cancel',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(4)
    const envelope = result.json as { summary: string }
    expect(envelope.summary).toContain('arun_1')
  })

  it('pauses without a gate', async () => {
    let body: unknown
    server.use(
      http.post(
        `${API}/v1/automations/audience-runs/arun_1/control`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({
            audienceRunId: 'arun_1',
            status: 'paused',
          })
        }
      )
    )
    const result = await runCli(
      [
        'automations',
        'audience-runs',
        'control',
        'arun_1',
        '--action',
        'pause',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ action: 'pause' })
    expect((result.json as { status: string }).status).toBe('paused')
  })
})

describe('domains health', () => {
  it('fetches the health report', async () => {
    server.use(
      http.get(`${API}/v1/domains/dom_1/health`, () =>
        HttpResponse.json({ verdict: 'healthy', signals: [] })
      )
    )
    const result = await runCli(['domains', 'health', 'dom_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect((result.json as { verdict: string }).verdict).toBe('healthy')
  })
})
