import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { audiencesCreateCommand } from '../../src/commands/audiences/create'
import { audiencesDeleteCommand } from '../../src/commands/audiences/delete'
import { audiencesGetCommand } from '../../src/commands/audiences/get'
import { audiencesListCommand } from '../../src/commands/audiences/list'
import { audiencesUpdateCommand } from '../../src/commands/audiences/update'
import { domainsAddCommand } from '../../src/commands/domains/add'
import { domainsDeleteCommand } from '../../src/commands/domains/delete'
import { domainsListCommand } from '../../src/commands/domains/list'
import { domainsUpdateCommand } from '../../src/commands/domains/update'
import { domainsVerifyCommand } from '../../src/commands/domains/verify'
import { sendsCancelCommand } from '../../src/commands/sends/cancel'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'

const EXTRA = [
  sendsCancelCommand,
  audiencesListCommand,
  audiencesGetCommand,
  audiencesCreateCommand,
  audiencesUpdateCommand,
  audiencesDeleteCommand,
  domainsListCommand,
  domainsAddCommand,
  domainsVerifyCommand,
  domainsUpdateCommand,
  domainsDeleteCommand,
]

function env(): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    BREW_API_KEY: KEY,
  }
}

const AUDIENCES_URL = 'https://brew.new/api/v1/audiences'
const DOMAINS_URL = 'https://brew.new/api/v1/domains'
const PAGE = { limit: 100, cursor: null, hasMore: false }

const FILTERS = {
  filters: [{ field: 'plan', operator: 'equals', value: 'vip' }],
  logicalOperator: 'and',
}

describe('sends cancel (confirmation protocol)', () => {
  it('exits 4 with an envelope when unconfirmed', async () => {
    const result = await runCli(['sends', 'cancel', 'snd_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(4)
    const envelope = result.json as Record<string, unknown>
    expect(envelope.confirmationRequired).toBe(true)
    expect(envelope.summary).toContain('snd_1')
  })

  it('cancels with --yes', async () => {
    server.use(
      http.post('https://brew.new/api/v1/sends/snd_1/cancel', () =>
        HttpResponse.json({ sendId: 'snd_1', status: 'canceled' })
      )
    )
    const result = await runCli(['sends', 'cancel', 'snd_1', '--yes'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect((result.json as { status: string }).status).toBe('canceled')
  })
})

describe('audiences list', () => {
  it('maps flags onto query parameters', async () => {
    let url: URL | undefined
    server.use(
      http.get(AUDIENCES_URL, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          data: [{ audienceId: 'aud_1', audienceName: 'VIP', count: 42 }],
          pagination: PAGE,
        })
      })
    )
    const result = await runCli(
      ['audiences', 'list', '--include', 'count', '--limit', '5'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('include')).toBe('count')
    expect(url?.searchParams.get('limit')).toBe('5')
    const data = result.json as { data: Array<{ audienceId: string }> }
    expect(data.data[0]?.audienceId).toBe('aud_1')
  })
})

describe('audiences get (derived)', () => {
  it('fetches one audience as a single-row page', async () => {
    let url: URL | undefined
    server.use(
      http.get(AUDIENCES_URL, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          data: [{ audienceId: 'aud_1', audienceName: 'VIP', count: 42 }],
          pagination: PAGE,
        })
      })
    )
    const result = await runCli(['audiences', 'get', 'aud_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('audienceId')).toBe('aud_1')
    expect((result.json as { audienceId: string }).audienceId).toBe('aud_1')
  })

  it('exits 1 with AUDIENCE_NOT_FOUND when missing', async () => {
    server.use(
      http.get(AUDIENCES_URL, () =>
        HttpResponse.json({ data: [], pagination: PAGE })
      )
    )
    const result = await runCli(['audiences', 'get', 'aud_ghost'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(1)
    const parsed = JSON.parse(result.stderr) as { error: { code: string } }
    expect(parsed.error.code).toBe('AUDIENCE_NOT_FOUND')
  })
})

describe('audiences create', () => {
  it('posts the name and filters', async () => {
    let body: unknown
    server.use(
      http.post(AUDIENCES_URL, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ audienceId: 'aud_new' }, { status: 201 })
      })
    )
    const result = await runCli(
      [
        'audiences',
        'create',
        '--name',
        'VIP',
        '--input',
        JSON.stringify({ filters: FILTERS }),
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ name: 'VIP', filters: FILTERS })
  })

  it('requires a name', async () => {
    const result = await runCli(
      ['audiences', 'create', '--input', JSON.stringify({ filters: FILTERS })],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(2)
  })
})

describe('audiences update', () => {
  it('patches the name', async () => {
    let body: unknown
    server.use(
      http.patch(`${AUDIENCES_URL}/aud_1`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ audienceId: 'aud_1' })
      })
    )
    const result = await runCli(
      ['audiences', 'update', 'aud_1', '--name', 'VIP customers'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ name: 'VIP customers' })
  })
})

describe('audiences delete (confirmation protocol)', () => {
  it('exits 4 with an envelope when unconfirmed', async () => {
    const result = await runCli(['audiences', 'delete', 'aud_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(4)
    expect((result.json as { summary: string }).summary).toContain('aud_1')
  })

  it('deletes with --yes', async () => {
    server.use(
      http.delete(`${AUDIENCES_URL}/aud_1`, () =>
        HttpResponse.json({ audienceId: 'aud_1', deleted: true })
      )
    )
    const result = await runCli(['audiences', 'delete', 'aud_1', '--yes'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect((result.json as { deleted: boolean }).deleted).toBe(true)
  })
})

describe('domains list', () => {
  it('filters to sendable domains', async () => {
    let url: URL | undefined
    server.use(
      http.get(DOMAINS_URL, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          data: [
            {
              domainId: 'dom_1',
              name: 'mail.example.com',
              status: 'verified',
              sendable: true,
            },
          ],
          pagination: PAGE,
        })
      })
    )
    const result = await runCli(['domains', 'list', '--sendable-only'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('sendableOnly')).toBe('true')
    const data = result.json as { data: Array<{ domainId: string }> }
    expect(data.data[0]?.domainId).toBe('dom_1')
  })
})

describe('domains add', () => {
  it('posts the positional domain name and returns DNS records', async () => {
    let body: unknown
    server.use(
      http.post(DOMAINS_URL, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          {
            domainId: 'dom_new',
            name: 'mail.example.com',
            status: 'pending',
            records: [
              {
                record: 'DKIM',
                name: 'resend._domainkey',
                type: 'TXT',
                ttl: 'Auto',
                status: 'not_started',
                value: 'p=abc',
              },
            ],
          },
          { status: 201 }
        )
      })
    )
    const result = await runCli(['domains', 'add', 'mail.example.com'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect(body).toEqual({ name: 'mail.example.com' })
    expect((result.json as { records: unknown[] }).records).toHaveLength(1)
  })
})

describe('domains verify', () => {
  it('posts a synchronous re-check', async () => {
    server.use(
      http.post(`${DOMAINS_URL}/dom_1/verify`, () =>
        HttpResponse.json({ domainId: 'dom_1', status: 'verified' })
      )
    )
    const result = await runCli(['domains', 'verify', 'dom_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect((result.json as { status: string }).status).toBe('verified')
  })
})

describe('domains update', () => {
  it('patches sender settings', async () => {
    let body: unknown
    server.use(
      http.patch(`${DOMAINS_URL}/dom_1`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ domainId: 'dom_1' })
      })
    )
    const result = await runCli(
      ['domains', 'update', 'dom_1', '--default-sender-name', 'Brew Coffee'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ defaultSenderName: 'Brew Coffee' })
  })

  it('rejects an empty update', async () => {
    const result = await runCli(['domains', 'update', 'dom_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(2)
  })
})

describe('domains delete (confirmation protocol)', () => {
  it('exits 4 with an envelope when unconfirmed', async () => {
    const result = await runCli(['domains', 'delete', 'dom_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(4)
    expect((result.json as { summary: string }).summary).toContain('dom_1')
  })

  it('deletes with --yes', async () => {
    server.use(
      http.delete(`${DOMAINS_URL}/dom_1`, () =>
        HttpResponse.json({ domainId: 'dom_1', deleted: true })
      )
    )
    const result = await runCli(['domains', 'delete', 'dom_1', '--yes'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect((result.json as { deleted: boolean }).deleted).toBe(true)
  })
})
