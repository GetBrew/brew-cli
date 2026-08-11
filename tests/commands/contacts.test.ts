import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'

function env(): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    BREW_API_KEY: KEY,
  }
}

const SEARCH_URL = 'https://brew.new/api/v1/contacts/search'

describe('contacts search', () => {
  it('builds the filter body from --filter flags', async () => {
    let body: unknown
    server.use(
      http.post(SEARCH_URL, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          data: [{ email: 'jane@example.com' }],
          pagination: { limit: 100, cursor: null, hasMore: false },
        })
      })
    )
    const result = await runCli(
      [
        'contacts',
        'search',
        '--filter',
        'email:equals:jane@example.com',
        '--limit',
        '10',
      ],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({
      count: false,
      filters: [
        { field: 'email', operator: 'equals', value: 'jane@example.com' },
      ],
      limit: 10,
    })
    const data = result.json as { data: Array<{ email: string }> }
    expect(data.data[0]?.email).toBe('jane@example.com')
  })

  it('merges flags over an --input body', async () => {
    let body: unknown
    server.use(
      http.post(SEARCH_URL, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          data: [],
          pagination: { limit: 5, cursor: null, hasMore: false },
        })
      })
    )
    const result = await runCli(
      [
        'contacts',
        'search',
        '--input',
        '{"search":"old","logic":"and"}',
        '--search',
        'new',
        '--limit',
        '5',
      ],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({
      count: false,
      search: 'new',
      logic: 'and',
      limit: 5,
    })
  })

  it('drains every page with --all', async () => {
    const pages = [
      {
        data: [{ email: 'a@x.com' }],
        pagination: { limit: 1, cursor: 'c1', hasMore: true },
      },
      {
        data: [{ email: 'b@x.com' }],
        pagination: { limit: 1, cursor: null, hasMore: false },
      },
    ]
    const cursors: Array<unknown> = []
    server.use(
      http.post(SEARCH_URL, async ({ request }) => {
        const body = (await request.json()) as { cursor?: string }
        cursors.push(body.cursor)
        return HttpResponse.json(pages[cursors.length - 1])
      })
    )
    const result = await runCli(['contacts', 'search', '--all'], {
      env: env(),
    })
    expect(result.code).toBe(0)
    expect(cursors).toEqual([undefined, 'c1'])
    const data = result.json as { data: unknown[]; pagination: unknown }
    expect(data.data).toHaveLength(2)
    expect(data.pagination).toEqual({ cursor: null, hasMore: false })
  })
})

describe('contacts get (derived)', () => {
  it('returns the single contact', async () => {
    server.use(
      http.post(SEARCH_URL, () =>
        HttpResponse.json({
          data: [{ email: 'jane@example.com', firstName: 'Jane' }],
          pagination: { limit: 1, cursor: null, hasMore: false },
        })
      )
    )
    const result = await runCli(['contacts', 'get', 'jane@example.com'], {
      env: env(),
    })
    expect(result.code).toBe(0)
    expect((result.json as { email: string }).email).toBe('jane@example.com')
  })

  it('exits 1 with CONTACT_NOT_FOUND when missing', async () => {
    server.use(
      http.post(SEARCH_URL, () =>
        HttpResponse.json({
          data: [],
          pagination: { limit: 1, cursor: null, hasMore: false },
        })
      )
    )
    const result = await runCli(['contacts', 'get', 'ghost@example.com'], {
      env: env(),
    })
    expect(result.code).toBe(1)
    const parsed = JSON.parse(result.stderr) as { error: { code: string } }
    expect(parsed.error.code).toBe('CONTACT_NOT_FOUND')
  })
})

describe('contacts upsert', () => {
  it('sends flags as a typed body with custom fields', async () => {
    let body: unknown
    server.use(
      http.post('https://brew.new/api/v1/contacts', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ email: 'j@x.com' }, { status: 201 })
      })
    )
    const result = await runCli(
      [
        'contacts',
        'upsert',
        '--email',
        'j@x.com',
        '--first-name',
        'Jane',
        '--custom',
        'plan=pro',
        '--custom',
        'seats=4',
      ],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({
      email: 'j@x.com',
      firstName: 'Jane',
      customFields: { plan: 'pro', seats: '4' },
    })
  })

  it('requires an email', async () => {
    const result = await runCli(['contacts', 'upsert'], { env: env() })
    expect(result.code).toBe(2)
  })
})

describe('contacts delete (confirmation protocol)', () => {
  it('exits 4 with an envelope when unconfirmed and non-interactive', async () => {
    const result = await runCli(['contacts', 'delete', 'jane@example.com'], {
      env: env(),
    })
    expect(result.code).toBe(4)
    const envelope = result.json as Record<string, unknown>
    expect(envelope.confirmationRequired).toBe(true)
    expect(envelope.summary).toContain('jane@example.com')
    expect(envelope.confirmCommand).toBe(
      'brew-cli contacts delete jane@example.com --yes'
    )
  })

  it('deletes with --yes', async () => {
    server.use(
      http.delete('https://brew.new/api/v1/contacts/jane%40example.com', () =>
        HttpResponse.json({ email: 'jane@example.com', deleted: true })
      ),
      http.delete('https://brew.new/api/v1/contacts/jane@example.com', () =>
        HttpResponse.json({ email: 'jane@example.com', deleted: true })
      )
    )
    const result = await runCli(
      ['contacts', 'delete', 'jane@example.com', '--yes'],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect((result.json as { deleted: boolean }).deleted).toBe(true)
  })

  it('prompts y/N on a TTY and aborts on "n"', async () => {
    const result = await runCli(['contacts', 'delete', 'jane@example.com'], {
      env: env(),
      ttyOut: true,
      ttyIn: true,
      promptAnswer: 'n',
    })
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Aborted')
  })
})

describe('contacts delete-many', () => {
  it('counts inline emails in the confirmation summary', async () => {
    const result = await runCli(
      [
        'contacts',
        'delete-many',
        '--input',
        '{"emails":["a@x.com","b@x.com"]}',
      ],
      { env: env() }
    )
    expect(result.code).toBe(4)
    expect((result.json as { summary: string }).summary).toContain(
      '2 contact(s)'
    )
  })

  it('wraps a bare stdin array and sends it when confirmed', async () => {
    let body: unknown
    server.use(
      http.post(
        'https://brew.new/api/v1/contacts/batch-delete',
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ deleted: 2 })
        }
      )
    )
    const result = await runCli(
      ['contacts', 'delete-many', '--input', '-', '--yes'],
      { env: env(), stdin: '["a@x.com","b@x.com"]' }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ emails: ['a@x.com', 'b@x.com'] })
  })
})

describe('contacts import-csv', () => {
  it('reads a CSV file and sends it with a mapping', async () => {
    let body: unknown
    server.use(
      http.post(
        'https://brew.new/api/v1/contacts/import-csv',
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ imported: 1 }, { status: 202 })
        }
      )
    )
    const dir = mkdtempSync(join(tmpdir(), 'brew-cli-csv-'))
    const csvPath = join(dir, 'contacts.csv')
    writeFileSync(csvPath, 'Email\njane@example.com\n')
    const result = await runCli(
      ['contacts', 'import-csv', '--file', csvPath, '--mapping', 'Email=email'],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({
      csv: 'Email\njane@example.com\n',
      mapping: { Email: 'email' },
    })
  })
})

describe('fields', () => {
  it('creates a field from flags', async () => {
    let body: unknown
    server.use(
      http.post('https://brew.new/api/v1/fields', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true }, { status: 201 })
      })
    )
    const result = await runCli(
      ['fields', 'create', '--name', 'plan', '--type', 'string'],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ fieldName: 'plan', fieldType: 'string' })
  })

  it('gates field deletion behind confirmation', async () => {
    const result = await runCli(['fields', 'delete', 'plan'], { env: env() })
    expect(result.code).toBe(4)
  })
})
