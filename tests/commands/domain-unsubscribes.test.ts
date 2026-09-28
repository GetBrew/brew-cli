import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { type RunCliOptions, runCli } from '../helpers/run-cli'

/**
 * `domains unsubscribes …`: a marketing sending domain's own unsubscribe
 * list, bound through the raw transport until the SDK ships the routes.
 * Each case pins the exact method, path, query and body the command sends.
 */

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const API = 'https://brew.new/api'
const DOMAIN = 'kx7bkh53hasmfeh5kd7sqgykt187g8ww'
const BASE = `${API}/v1/domains/${DOMAIN}/unsubscribes`

function env(): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    BREW_API_KEY: KEY,
    BREW_BRAND_ID: 'kxbrand1',
  }
}

function cli(
  argv: readonly string[],
  options: Omit<RunCliOptions, 'env'> = {}
): ReturnType<typeof runCli> {
  return runCli(['domains', 'unsubscribes', ...argv], {
    ...options,
    env: env(),
  })
}

const ROW = {
  email: 'jane@example.com',
  scope: 'domain',
  unsubscribedAt: '2026-09-17T09:12:00.000Z',
  source: 'link',
  sendId: 'kh7c1w2m3n4p5q6r7s8t9u0v1w2x3y4z',
}

describe('domains unsubscribes list', () => {
  it('maps the flags onto the spec query and binds the brand', async () => {
    let url: URL | undefined
    let brand: string | null = null
    server.use(
      http.get(BASE, ({ request }) => {
        url = new URL(request.url)
        brand = request.headers.get('x-brand-id')
        return HttpResponse.json({
          domainId: DOMAIN,
          domainHost: 'send.example.com',
          data: [ROW],
          pagination: { limit: 50, cursor: null, hasMore: false },
        })
      })
    )
    const result = await cli([
      'list',
      DOMAIN,
      '--query',
      'jane@',
      '--scope',
      'domain',
      '--limit',
      '50',
      '--cursor',
      'cur_1',
    ])
    expect(result.code).toBe(0)
    expect(url?.pathname).toBe(`/api/v1/domains/${DOMAIN}/unsubscribes`)
    expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({
      q: 'jane@',
      scope: 'domain',
      limit: '50',
      cursor: 'cur_1',
    })
    expect(brand).toBe('kxbrand1')
    const page = result.json as { domainHost: string; data: unknown[] }
    expect(page.domainHost).toBe('send.example.com')
    expect(page.data).toEqual([ROW])
  })

  it('follows the cursor with --all and keeps the domain fields', async () => {
    const cursors: Array<string | null> = []
    server.use(
      http.get(BASE, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        cursors.push(cursor)
        return HttpResponse.json({
          domainId: DOMAIN,
          domainHost: 'send.example.com',
          data: [{ ...ROW, email: cursor === null ? 'a@x.com' : 'b@x.com' }],
          pagination: {
            limit: 1,
            cursor: cursor === null ? 'cur_2' : null,
            hasMore: cursor === null,
          },
        })
      })
    )
    const result = await cli(['list', DOMAIN, '--all', '--quiet'])
    expect(result.code).toBe(0)
    expect(cursors).toEqual([null, 'cur_2'])
    expect(result.json).toEqual({
      domainId: DOMAIN,
      domainHost: 'send.example.com',
      data: [
        { ...ROW, email: 'a@x.com' },
        { ...ROW, email: 'b@x.com' },
      ],
      pagination: { cursor: null, hasMore: false },
    })
  })

  it('renders a table on a TTY', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json({
          domainId: DOMAIN,
          domainHost: 'send.example.com',
          data: [ROW],
          pagination: { limit: 100, cursor: null, hasMore: false },
        })
      )
    )
    const result = await cli(['list', DOMAIN], { ttyOut: true })
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('EMAIL')
    expect(result.stdout).toContain('jane@example.com')
    expect(result.stdout).toContain('domain')
  })
})

describe('domains unsubscribes add', () => {
  it('posts --emails as the body with the caller idempotency key', async () => {
    let body: unknown
    let idempotencyKey: string | null = null
    server.use(
      http.post(BASE, async ({ request }) => {
        body = await request.json()
        idempotencyKey = request.headers.get('idempotency-key')
        return HttpResponse.json({
          domainId: DOMAIN,
          domainHost: 'send.example.com',
          summary: {
            received: 2,
            added: 1,
            alreadyUnsubscribed: 0,
            created: 1,
            invalid: 0,
          },
          invalid: [],
        })
      })
    )
    const result = await cli([
      'add',
      DOMAIN,
      '--emails',
      'jane@example.com',
      'sam@example.com',
      '--idempotency-key',
      'unsub-1',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({ emails: ['jane@example.com', 'sam@example.com'] })
    expect(idempotencyKey).toBe('unsub-1')
    expect((result.json as { summary: { added: number } }).summary.added).toBe(
      1
    )
  })

  it('accepts a bare JSON array on --input', async () => {
    let body: unknown
    server.use(
      http.post(BASE, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          domainId: DOMAIN,
          domainHost: 'send.example.com',
          summary: {
            received: 1,
            added: 1,
            alreadyUnsubscribed: 0,
            created: 0,
            invalid: 0,
          },
          invalid: [],
        })
      })
    )
    const result = await cli(['add', DOMAIN, '--input', '-'], {
      stdin: '["jane@example.com"]',
    })
    expect(result.code).toBe(0)
    expect(body).toEqual({ emails: ['jane@example.com'] })
  })

  it('refuses a call with no addresses (exit 2, no request)', async () => {
    const result = await cli(['add', DOMAIN])
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('--emails')
  })
})

describe('domains unsubscribes remove', () => {
  it('gates behind confirmation (exit 4, no request)', async () => {
    const result = await cli(['remove', DOMAIN, 'jane@example.com'])
    expect(result.code).toBe(4)
    const envelope = result.json as {
      summary: string
      confirmCommand: string
    }
    expect(envelope.summary).toContain('jane@example.com')
    expect(envelope.summary).toContain(DOMAIN)
    expect(envelope.confirmCommand).toBe(
      `brew-cli domains unsubscribes remove ${DOMAIN} jane@example.com --yes`
    )
  })

  it('DELETEs the URL-encoded address with --yes', async () => {
    let pathname: string | undefined
    server.use(
      http.delete(`${BASE}/:email`, ({ request }) => {
        pathname = new URL(request.url).pathname
        return HttpResponse.json({
          domainId: DOMAIN,
          domainHost: 'send.example.com',
          email: 'jane+news@example.com',
          removed: true,
          globallyUnsubscribed: false,
        })
      })
    )
    const result = await cli([
      'remove',
      DOMAIN,
      'jane+news@example.com',
      '--yes',
    ])
    expect(result.code).toBe(0)
    expect(pathname).toBe(
      `/api/v1/domains/${DOMAIN}/unsubscribes/jane%2Bnews%40example.com`
    )
    expect((result.json as { removed: boolean }).removed).toBe(true)
    expect(result.stderr).toBe('')
  })

  it('warns on stderr when the brand-wide opt-out still applies', async () => {
    server.use(
      http.delete(`${BASE}/:email`, () =>
        HttpResponse.json({
          domainId: DOMAIN,
          domainHost: 'send.example.com',
          email: 'jane@example.com',
          removed: true,
          globallyUnsubscribed: true,
        })
      )
    )
    const result = await cli(['remove', DOMAIN, 'jane@example.com', '--yes'])
    expect(result.code).toBe(0)
    expect(
      (result.json as { globallyUnsubscribed: boolean }).globallyUnsubscribed
    ).toBe(true)
    expect(result.stderr).toContain(
      'brew-cli contacts update jane@example.com --subscribed true'
    )
  })
})

describe('domains unsubscribes import', () => {
  const IMPORTED = {
    domainId: DOMAIN,
    domainHost: 'send.example.com',
    summary: {
      rows: 2,
      added: 1,
      alreadyUnsubscribed: 0,
      created: 1,
      skipped: 0,
    },
    skippedSample: [],
    truncated: false,
    column: 'Email Address',
  }

  it('posts the CSV file text and --column', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'brew-unsub-import-'))
    const file = join(directory, 'unsubscribes.csv')
    const csv = 'Email Address\njane@example.com\nsam@example.com\n'
    writeFileSync(file, csv)
    let body: unknown
    let idempotencyKey: string | null = null
    server.use(
      http.post(`${BASE}/import`, async ({ request }) => {
        body = await request.json()
        idempotencyKey = request.headers.get('idempotency-key')
        return HttpResponse.json(IMPORTED)
      })
    )
    const result = await cli([
      'import',
      DOMAIN,
      '--file',
      file,
      '--column',
      'Email Address',
      '--idempotency-key',
      'import-1',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({ csv, column: 'Email Address' })
    expect(idempotencyKey).toBe('import-1')
    expect(result.json).toEqual(IMPORTED)
  })

  it('reads the CSV from stdin and warns when the file was truncated', async () => {
    let body: unknown
    server.use(
      http.post(`${BASE}/import`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ...IMPORTED, truncated: true })
      })
    )
    const result = await cli(['import', DOMAIN, '--file', '-'], {
      stdin: 'email\njane@example.com\n',
    })
    expect(result.code).toBe(0)
    expect(body).toEqual({ csv: 'email\njane@example.com\n' })
    expect(result.stderr).toContain('10,000')
  })

  it('requires --file (exit 2, no request)', async () => {
    const result = await cli(['import', DOMAIN])
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('--file')
  })
})

describe('domains unsubscribes export', () => {
  const CSV =
    'Email,Scope,Unsubscribed At,Source,Send ID\r\njane@example.com,domain,2026-09-17T09:12:00.000Z,link,kh7c1w2m3n4p5q6r7s8t9u0v1w2x3y4z\r\n'

  it('passes --scope and prints the envelope in JSON mode', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${BASE}/export`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          domainId: DOMAIN,
          domainHost: 'send.example.com',
          csv: CSV,
          rowCount: 1,
          truncated: false,
        })
      })
    )
    const result = await cli(['export', DOMAIN, '--scope', 'domain'])
    expect(result.code).toBe(0)
    expect(url?.pathname).toBe(`/api/v1/domains/${DOMAIN}/unsubscribes/export`)
    expect(url?.searchParams.get('scope')).toBe('domain')
    expect((result.json as { csv: string }).csv).toBe(CSV)
    expect(result.stderr).toBe('')
  })

  it('prints the raw CSV on a TTY and warns when truncated', async () => {
    server.use(
      http.get(`${BASE}/export`, () =>
        HttpResponse.json({
          domainId: DOMAIN,
          domainHost: 'send.example.com',
          csv: CSV,
          rowCount: 1,
          truncated: true,
        })
      )
    )
    const result = await cli(['export', DOMAIN], { ttyOut: true })
    expect(result.code).toBe(0)
    expect(result.stdout).toBe(`${CSV.replace(/\r\n$/, '')}\n`)
    expect(result.stderr).toContain('--scope')
  })
})
