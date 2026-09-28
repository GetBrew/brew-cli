import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { analyticsEventCountsCommand } from '../../src/commands/analytics/event-counts'
import { domainsUnsubscribesAddCommand } from '../../src/commands/domains/unsubscribes/add'
import { domainsUnsubscribesExportCommand } from '../../src/commands/domains/unsubscribes/export'
import { domainsUnsubscribesImportCommand } from '../../src/commands/domains/unsubscribes/import'
import { domainsUnsubscribesListCommand } from '../../src/commands/domains/unsubscribes/list'
import { domainsUnsubscribesRemoveCommand } from '../../src/commands/domains/unsubscribes/remove'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const API = 'https://brew.new/api'
const LIST = `${API}/v1/domains/dom_1/unsubscribes`

const EXTRA = [
  analyticsEventCountsCommand,
  domainsUnsubscribesListCommand,
  domainsUnsubscribesAddCommand,
  domainsUnsubscribesRemoveCommand,
  domainsUnsubscribesImportCommand,
  domainsUnsubscribesExportCommand,
]

function env(): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    BREW_API_KEY: KEY,
  }
}

describe('analytics event-counts', () => {
  it('sends groupBy, bucket and the filters to the events read, never a page', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/analytics/events`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          count: 9,
          groups: [{ key: { link: 'https://example.com/a' }, count: 9 }],
          otherCount: 0,
          range: { from: 'a', to: 'b' },
          truncated: false,
        })
      })
    )
    const result = await runCli(
      [
        'analytics',
        'event-counts',
        '--group-by',
        'eventType,link',
        '--bucket',
        'day',
        '--event-type',
        'clicked',
        '--send-id',
        'snd_1',
        '--since',
        '2026-09-01T00:00:00Z',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('groupBy')).toBe('eventType,link')
    expect(url?.searchParams.get('bucket')).toBe('day')
    expect(url?.searchParams.get('eventType')).toBe('clicked')
    expect(url?.searchParams.get('sendId')).toBe('snd_1')
    expect(url?.searchParams.get('from')).toBe('2026-09-01T00:00:00Z')
    expect(url?.searchParams.has('cursor')).toBe(false)
    expect(url?.searchParams.has('limit')).toBe(false)
    expect((result.json as { count: number }).count).toBe(9)
  })

  it('refuses a count with neither --group-by nor --bucket before any request', async () => {
    const result = await runCli(['analytics', 'event-counts'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).not.toBe(0)
  })
})

describe('domains unsubscribes', () => {
  it('lists one page, forwarding q, scope, limit and cursor', async () => {
    let url: URL | undefined
    server.use(
      http.get(LIST, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          data: [{ email: 'ada@example.com', scope: 'domain' }],
          pagination: { limit: 10, cursor: null, hasMore: false },
        })
      })
    )
    const result = await runCli(
      [
        'domains',
        'unsubscribes',
        'list',
        'dom_1',
        '--q',
        'ada',
        '--scope',
        'domain',
        '--limit',
        '10',
        '--cursor',
        'c_1',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('q')).toBe('ada')
    expect(url?.searchParams.get('scope')).toBe('domain')
    expect(url?.searchParams.get('limit')).toBe('10')
    expect(url?.searchParams.get('cursor')).toBe('c_1')
  })

  it('adds addresses with the retry key', async () => {
    let body: unknown
    let key: string | null = null
    server.use(
      http.post(LIST, async ({ request }) => {
        body = await request.json()
        key = request.headers.get('idempotency-key')
        return HttpResponse.json({
          domainId: 'dom_1',
          domainHost: 'mail.example.com',
          summary: { added: 2, alreadyUnsubscribed: 0, created: 0 },
          invalid: [],
        })
      })
    )
    const result = await runCli(
      [
        'domains',
        'unsubscribes',
        'add',
        'dom_1',
        '--email',
        'ada@example.com',
        '--email',
        'bo@example.com',
        '--idempotency-key',
        'add-once',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ emails: ['ada@example.com', 'bo@example.com'] })
    expect(key).toBe('add-once')
  })

  it('removes one address, encoded into the path', async () => {
    let pathname: string | undefined
    server.use(
      http.delete(`${LIST}/:email`, ({ request }) => {
        pathname = new URL(request.url).pathname
        return HttpResponse.json({
          domainId: 'dom_1',
          domainHost: 'mail.example.com',
          email: 'ada+news@example.com',
          removed: true,
          globallyUnsubscribed: false,
        })
      })
    )
    const result = await runCli(
      ['domains', 'unsubscribes', 'remove', 'dom_1', 'ada+news@example.com'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(pathname).toBe(
      '/api/v1/domains/dom_1/unsubscribes/ada%2Bnews%40example.com'
    )
  })

  it('imports a CSV file with the column to read', async () => {
    let body: unknown
    server.use(
      http.post(`${LIST}/import`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          domainId: 'dom_1',
          domainHost: 'mail.example.com',
          summary: { added: 1, alreadyUnsubscribed: 0, created: 0 },
          invalid: [],
        })
      })
    )
    const dir = mkdtempSync(join(tmpdir(), 'brew-cli-csv-'))
    const file = join(dir, 'optouts.csv')
    writeFileSync(file, 'Email\nada@example.com\n')
    const result = await runCli(
      [
        'domains',
        'unsubscribes',
        'import',
        'dom_1',
        '--file',
        file,
        '--column',
        'Email',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ csv: 'Email\nada@example.com\n', column: 'Email' })
  })

  it('exports the list narrowed by scope', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${LIST}/export`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          domainId: 'dom_1',
          domainHost: 'mail.example.com',
          csv: 'email\nada@example.com\n',
          rowCount: 1,
          truncated: false,
        })
      })
    )
    const result = await runCli(
      ['domains', 'unsubscribes', 'export', 'dom_1', '--scope', 'all'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('scope')).toBe('all')
  })
})
