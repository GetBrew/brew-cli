import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

/**
 * The query parameters these commands could not send before: fields
 * coverage and paging, a saved email version or run, brand status and
 * paging, and api-key / integration paging. Each flag lands on the wire as
 * the spec names it; `--all` follows the cursor.
 */

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const API = 'https://brew.new/api'

function env(): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    BREW_API_KEY: KEY,
  }
}

/** Serves two pages (`c1` → `c2` → end) and records every query seen. */
function twoPages(
  path: string,
  rows: [unknown, unknown]
): Array<URLSearchParams> {
  const seen: Array<URLSearchParams> = []
  server.use(
    http.get(`${API}${path}`, ({ request }) => {
      const query = new URL(request.url).searchParams
      seen.push(query)
      const isSecond = query.get('cursor') === 'c2'
      return HttpResponse.json({
        data: [isSecond ? rows[1] : rows[0]],
        pagination: {
          limit: 1,
          cursor: isSecond ? null : 'c2',
          hasMore: !isSecond,
        },
      })
    })
  )
  return seen
}

describe('fields list', () => {
  it('sends --include, --audience-id, --limit and --cursor', async () => {
    const seen = twoPages('/v1/fields', [{ fieldName: 'plan' }, {}])
    const result = await runCli(
      [
        'fields',
        'list',
        '--include',
        'coverage',
        '--audience-id',
        'aud_1',
        '--limit',
        '10',
        '--cursor',
        'c0',
        '--json',
      ],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(Object.fromEntries(seen[0] ?? [])).toEqual({
      include: 'coverage',
      audienceId: 'aud_1',
      limit: '10',
      cursor: 'c0',
    })
  })

  it('follows the cursor with --all', async () => {
    const seen = twoPages('/v1/fields', [
      { fieldName: 'plan' },
      { fieldName: 'region' },
    ])
    const result = await runCli(['fields', 'list', '--all', '--json'], {
      env: env(),
    })
    expect(result.code).toBe(0)
    expect(seen.map((query) => query.get('cursor'))).toEqual([null, 'c2'])
    expect((result.json as { data: Array<unknown> }).data).toEqual([
      { fieldName: 'plan' },
      { fieldName: 'region' },
    ])
  })
})

describe('brands list', () => {
  it('sends --status, --limit and --cursor', async () => {
    const seen = twoPages('/v1/brands', [{ brandId: 'b_1' }, {}])
    const result = await runCli(
      [
        'brands',
        'list',
        '--status',
        'completed',
        '--limit',
        '5',
        '--cursor',
        'c0',
        '--json',
      ],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(Object.fromEntries(seen[0] ?? [])).toEqual({
      status: 'completed',
      limit: '5',
      cursor: 'c0',
    })
  })

  it('follows the cursor with --all', async () => {
    const seen = twoPages('/v1/brands', [
      { brandId: 'b_1' },
      { brandId: 'b_2' },
    ])
    const result = await runCli(['brands', 'list', '--all', '--json'], {
      env: env(),
    })
    expect(result.code).toBe(0)
    expect(seen).toHaveLength(2)
    expect((result.json as { data: Array<unknown> }).data).toHaveLength(2)
  })
})

describe('emails get', () => {
  const EMAIL = 'eml_2SmZOWV3ZQ7W5x6g3m4p'

  function captureGet(): Array<URLSearchParams> {
    const seen: Array<URLSearchParams> = []
    server.use(
      http.get(`${API}/v1/emails/${EMAIL}`, ({ request }) => {
        seen.push(new URL(request.url).searchParams)
        return HttpResponse.json({ emailId: EMAIL, status: 'ready' })
      })
    )
    return seen
  }

  it('reads a saved version with --email-version-id', async () => {
    const seen = captureGet()
    const result = await runCli(
      [
        'emails',
        'get',
        EMAIL,
        '--email-version-id',
        'emv_1',
        '--include',
        'html',
        '--json',
      ],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(Object.fromEntries(seen[0] ?? [])).toEqual({
      include: 'html',
      emailVersionId: 'emv_1',
    })
  })

  it('reads the version a run produced with --run-id', async () => {
    const seen = captureGet()
    const result = await runCli(
      ['emails', 'get', EMAIL, '--run-id', 'run_1', '--json'],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(Object.fromEntries(seen[0] ?? [])).toEqual({ runId: 'run_1' })
  })

  it('refuses --email-version-id with --run-id before any request', async () => {
    const seen = captureGet()
    const result = await runCli(
      [
        'emails',
        'get',
        EMAIL,
        '--email-version-id',
        'emv_1',
        '--run-id',
        'run_1',
      ],
      { env: env() }
    )
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain('--email-version-id or --run-id')
    expect(seen).toHaveLength(0)
  })

  it('still reads the head through the SDK without a selector', async () => {
    const seen = captureGet()
    const result = await runCli(
      ['emails', 'get', EMAIL, '--include', 'versions', '--json'],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(Object.fromEntries(seen[0] ?? [])).toEqual({ include: 'versions' })
  })
})

describe.each([
  ['api-keys', '/v1/api-keys', { keyId: 'key_1' }, { keyId: 'key_2' }],
  [
    'integrations',
    '/v1/integrations',
    { provider: 'shopify' },
    { provider: 'klaviyo' },
  ],
] as const)('%s list', (group, path, first, second) => {
  it('sends --limit and --cursor', async () => {
    const seen = twoPages(path, [first, second])
    const result = await runCli(
      [group, 'list', '--limit', '1', '--cursor', 'c0', '--json'],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(Object.fromEntries(seen[0] ?? [])).toEqual({
      limit: '1',
      cursor: 'c0',
    })
  })

  it('follows the cursor with --all', async () => {
    const seen = twoPages(path, [first, second])
    const result = await runCli([group, 'list', '--all', '--json'], {
      env: env(),
    })
    expect(result.code).toBe(0)
    expect(seen.map((query) => query.get('cursor'))).toEqual([null, 'c2'])
    expect((result.json as { data: Array<unknown> }).data).toEqual([
      first,
      second,
    ])
  })

  it('sends no query without the flags', async () => {
    const seen = twoPages(path, [first, second])
    const result = await runCli([group, 'list', '--json'], { env: env() })
    expect(result.code).toBe(0)
    expect([...(seen[0] ?? [])]).toEqual([])
  })
})
