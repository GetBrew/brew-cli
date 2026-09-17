import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { flowsListCommand } from '../../src/commands/flows/list'
import { server } from '../helpers/msw-server'
import {
  type RunCliOptions,
  type RunCliResult,
  runCli,
} from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const API = 'https://brew.new/api'
const PAGE_DONE = { limit: 100, cursor: null, hasMore: false }

function cli(
  argv: readonly string[],
  options: Omit<RunCliOptions, 'env' | 'extraCommands'> = {}
): Promise<RunCliResult> {
  return runCli(argv, {
    ...options,
    env: {
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
      BREW_API_KEY: KEY,
      BREW_BRAND_ID: 'kx7b3s7fapqz8mjm12ekz1kxdx87yceg',
    },
    extraCommands: [flowsListCommand],
  })
}

const CARD = {
  slug: 'notion.com',
  brand: { name: 'Notion' },
  title: 'Notion onboarding flow',
  type: 'signup',
  category: 'welcome',
  categoryLabel: 'Welcome',
  emailCount: 2,
  spanDays: 2.1,
  remixCount: 4,
  previewImages: ['https://cdn.brew.new/p1.png'],
  publishedAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-02T12:00:00.000Z',
}

const DETAIL = {
  ...CARD,
  anchor: 'signedUpAt',
  steps: [
    {
      order: 1,
      dayOffset: 0,
      delayDays: 0,
      subject: 'Welcome to Notion',
      category: 'welcome',
      categoryLabel: 'Welcome',
      emailId: 'pt1_aaa',
    },
    {
      order: 2,
      dayOffset: 2.1,
      delayDays: 2.1,
      subject: 'Three templates to try',
      category: 'education',
      categoryLabel: 'Education',
      emailId: 'pt1_bbb',
      html: '<html>two</html>',
    },
  ],
}

describe('flows list', () => {
  it('maps every list flag onto the spec query, org-level (no brand header)', async () => {
    let url: URL | undefined
    let brandHeader: string | null = 'unset'
    server.use(
      http.get(`${API}/v1/flows`, ({ request }) => {
        url = new URL(request.url)
        brandHeader = request.headers.get('x-brand-id')
        return HttpResponse.json({ data: [CARD], pagination: PAGE_DONE })
      })
    )
    const result = await cli([
      'flows',
      'list',
      '--brand-domain',
      'notion.com',
      '--category',
      'welcome',
      '--type',
      'signup',
      '--semantic',
      'developer onboarding drip',
      '--sort',
      'emails',
      '--limit',
      '5',
    ])
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('brand')).toBe('notion.com')
    expect(url?.searchParams.get('category')).toBe('welcome')
    expect(url?.searchParams.get('type')).toBe('signup')
    expect(url?.searchParams.get('semantic')).toBe('developer onboarding drip')
    expect(url?.searchParams.get('sort')).toBe('emails')
    expect(url?.searchParams.get('limit')).toBe('5')
    expect(url?.searchParams.has('slug')).toBe(false)
    expect(url?.searchParams.has('include')).toBe(false)
    // The gallery is organization-wide: the brand binding never rides along.
    expect(brandHeader).toBeNull()
    const data = result.json as { data: Array<{ slug: string }> }
    expect(data.data[0]?.slug).toBe('notion.com')
  })

  it('fetches one flow by --slug with --include html', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/flows`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ data: [DETAIL] })
      })
    )
    const result = await cli([
      'flows',
      'list',
      '--slug',
      'notion.com',
      '--include',
      'html',
    ])
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('slug')).toBe('notion.com')
    expect(url?.searchParams.get('include')).toBe('html')
    const data = result.json as {
      data: Array<{ steps: Array<{ emailId: string; html?: string }> }>
      pagination?: unknown
    }
    expect(data.pagination).toBeUndefined()
    expect(data.data[0]?.steps.map((step) => step.emailId)).toEqual([
      'pt1_aaa',
      'pt1_bbb',
    ])
    expect(data.data[0]?.steps[1]?.html).toBe('<html>two</html>')
  })

  it('renders the steps as a table on a TTY', async () => {
    server.use(
      http.get(`${API}/v1/flows`, () => HttpResponse.json({ data: [DETAIL] }))
    )
    const result = await cli(['flows', 'list', '--slug', 'notion.com'], {
      ttyOut: true,
    })
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Notion onboarding flow')
    expect(result.stdout).toContain('day 0 = signedUpAt')
    expect(result.stdout).toContain('Three templates to try')
    expect(result.stdout).toContain('pt1_bbb')
  })

  it('--all follows the cursor across pages', async () => {
    const cursors: Array<string | null> = []
    server.use(
      http.get(`${API}/v1/flows`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        cursors.push(cursor)
        return cursor === null
          ? HttpResponse.json({
              data: [CARD],
              pagination: { limit: 1, cursor: 'page-2', hasMore: true },
            })
          : HttpResponse.json({
              data: [{ ...CARD, slug: 'linear.app' }],
              pagination: { limit: 1, cursor: null, hasMore: false },
            })
      })
    )
    const result = await cli(['flows', 'list', '--all', '--limit', '1'])
    expect(result.code).toBe(0)
    expect(cursors).toEqual([null, 'page-2'])
    const data = result.json as { data: Array<{ slug: string }> }
    expect(data.data.map((row) => row.slug)).toEqual([
      'notion.com',
      'linear.app',
    ])
  })

  it('refuses --all with --slug as a usage error', async () => {
    const result = await cli(['flows', 'list', '--all', '--slug', 'notion.com'])
    expect(result.code).toBe(2)
  })

  it('surfaces the typed 404 envelope for an unknown slug', async () => {
    server.use(
      http.get(`${API}/v1/flows`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'FLOW_NOT_FOUND',
              type: 'not_found',
              message: "No public flow matches slug 'nobody.example'.",
              param: 'slug',
            },
          },
          { status: 404 }
        )
      )
    )
    const result = await cli(['flows', 'list', '--slug', 'nobody.example'])
    expect(result.code).toBe(1)
    const body = JSON.parse(result.stderr) as {
      error: { code: string; param?: string }
    }
    expect(body.error.code).toBe('FLOW_NOT_FOUND')
    expect(body.error.param).toBe('slug')
  })
})
