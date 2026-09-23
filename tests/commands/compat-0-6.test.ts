import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { type RunCliResult, runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const API = 'https://brew.new/api'
const ONE_ROW = { cursor: null, hasMore: false }
const EMPTY_PAGE = { data: [], pagination: { limit: 100, ...ONE_ROW } }
// The detail row is the card plus `anchor` and `steps`; the human renderer
// reads the card fields, so the fixture carries them.
const FLOW = {
  slug: 'notion.com',
  brand: { name: 'Notion' },
  title: 'Notion onboarding flow',
  type: 'signup',
  category: 'welcome',
  emailCount: 2,
  spanDays: 2.1,
  anchor: 'signedUpAt',
  steps: [],
}

function cli(argv: readonly string[]): Promise<RunCliResult> {
  return runCli(argv, {
    env: {
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
      BREW_API_KEY: KEY,
      BREW_BRAND_ID: 'kx7b3s7fapqz8mjm12ekz1kxdx87yceg',
    },
  })
}

/**
 * Flags and command names are additive-only after release (AGENTS.md).
 * Where the API moved under a released flag, the flag answers the way 0.6
 * did: an id flag on a list performs the detail read and pages that one
 * row; `--include` without its id flag is a usage error naming the command
 * that takes it.
 */
describe('0.6 compatibility shims', () => {
  it('`runs list --run <id> --include logs` performs the detail read and pages the one row', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/automations/runs/run_1`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          automationRunId: 'run_1',
          status: 'completed',
          logs: [],
        })
      })
    )
    const result = await cli([
      'automations',
      'runs',
      'list',
      '--run',
      'run_1',
      '--include',
      'logs',
    ])
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('include')).toBe('logs')
    expect(result.json).toEqual({
      data: [{ automationRunId: 'run_1', status: 'completed', logs: [] }],
      pagination: ONE_ROW,
    })
  })

  it('`runs list --input` carrying the 0.6 id and include keys takes the detail branch too', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/automations/runs/run_1`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ automationRunId: 'run_1', logs: [] })
      })
    )
    const result = await cli([
      'automations',
      'runs',
      'list',
      '--input',
      '{"automationRunId":"run_1","include":"logs"}',
    ])
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('include')).toBe('logs')
    expect(result.json).toEqual({
      data: [{ automationRunId: 'run_1', logs: [] }],
      pagination: ONE_ROW,
    })
  })

  it('`runs list --include` without --run exits 2 naming `runs get`', async () => {
    const result = await cli([
      'automations',
      'runs',
      'list',
      '--include',
      'logs',
    ])
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('automations runs get')
  })

  it('`runs list --recipient` is the recipientEmail filter', async () => {
    let query: URLSearchParams | undefined
    server.use(
      http.get(`${API}/v1/automations/runs`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json(EMPTY_PAGE)
      })
    )
    const result = await cli([
      'automations',
      'runs',
      'list',
      '--recipient',
      'Jane@Example.com',
    ])
    expect(result.code).toBe(0)
    expect(query?.get('recipientEmail')).toBe('Jane@Example.com')
  })

  it('`audience-runs control --action pause` posts the pause action sub-path, ungated', async () => {
    let method: string | undefined
    server.use(
      http.post(
        `${API}/v1/automations/audience-runs/arun_1/pause`,
        ({ request }) => {
          method = request.method
          return HttpResponse.json({
            audienceRunId: 'arun_1',
            status: 'paused',
          })
        }
      )
    )
    const result = await cli([
      'automations',
      'audience-runs',
      'control',
      'arun_1',
      '--action',
      'pause',
    ])
    expect(result.code).toBe(0)
    expect(method).toBe('POST')
    expect(result.json).toEqual({ audienceRunId: 'arun_1', status: 'paused' })
  })

  it('`audience-runs control --action cancel` stays confirm-gated', async () => {
    const result = await cli([
      'automations',
      'audience-runs',
      'control',
      'arun_1',
      '--action',
      'cancel',
    ])
    expect(result.code).toBe(4)
    expect(
      (result.json as { confirmationRequired?: boolean }).confirmationRequired
    ).toBe(true)
  })

  it('`audience-runs control` without --action exits 2', async () => {
    const result = await cli([
      'automations',
      'audience-runs',
      'control',
      'arun_1',
    ])
    expect(result.code).toBe(2)
  })

  it('`audience-runs list --automation-id` is --automation; `--audience-run-id` pages the detail read', async () => {
    let query: URLSearchParams | undefined
    server.use(
      http.get(`${API}/v1/automations/audience-runs`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json(EMPTY_PAGE)
      }),
      http.get(`${API}/v1/automations/audience-runs/arun_1`, () =>
        HttpResponse.json({ audienceRunId: 'arun_1', status: 'running' })
      )
    )
    const list = await cli([
      'automations',
      'audience-runs',
      'list',
      '--automation-id',
      'am_1',
    ])
    expect(list.code).toBe(0)
    expect(query?.get('automationId')).toBe('am_1')
    const one = await cli([
      'automations',
      'audience-runs',
      'list',
      '--audience-run-id',
      'arun_1',
    ])
    expect(one.code).toBe(0)
    expect(one.json).toEqual({
      data: [{ audienceRunId: 'arun_1', status: 'running' }],
      pagination: ONE_ROW,
    })
  })

  it('`emails list --created-at-from` folds onto sortBy=createdAt + from; --order desc is accepted', async () => {
    let query: URLSearchParams | undefined
    server.use(
      http.get(`${API}/v1/emails`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json(EMPTY_PAGE)
      })
    )
    const result = await cli([
      'emails',
      'list',
      '--created-at-from',
      '2026-08-01T00:00:00Z',
      '--order',
      'desc',
    ])
    expect(result.code).toBe(0)
    expect(query?.get('sortBy')).toBe('createdAt')
    expect(query?.get('from')).toBe('2026-08-01T00:00:00Z')
    expect(query?.has('order')).toBe(false)
  })

  it('`emails list` exits 2 when both 0.6 columns are windowed, or on --order asc', async () => {
    const mixed = await cli([
      'emails',
      'list',
      '--created-at-from',
      '2026-08-01T00:00:00Z',
      '--updated-at-to',
      '2026-09-01T00:00:00Z',
    ])
    expect(mixed.code).toBe(2)
    const asc = await cli(['emails', 'list', '--order', 'asc'])
    expect(asc.code).toBe(2)
  })

  it('`emails list` exits 2 when a 0.6 window column disagrees with an explicit sort', async () => {
    const result = await cli([
      'emails',
      'list',
      '--sort',
      'updatedAt',
      '--created-at-from',
      '2026-08-01T00:00:00Z',
    ])
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('createdAt')
  })

  it('`audiences list --include` exits 2 naming `audiences get`', async () => {
    const result = await cli(['audiences', 'list', '--include', 'count'])
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('audiences get')
  })

  it('`analytics sends list --send <id> --include events` performs the detail read and pages the one row', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/sends/snd_1`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ sendId: 'snd_1', status: 'completed' })
      })
    )
    const result = await cli([
      'analytics',
      'sends',
      'list',
      '--send',
      'snd_1',
      '--include',
      'events',
    ])
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('include')).toBe('events')
    expect(result.json).toEqual({
      data: [{ sendId: 'snd_1', status: 'completed' }],
      pagination: ONE_ROW,
    })
  })

  it('`flows list --slug <domain>` performs the detail read and pages the one row', async () => {
    server.use(
      http.get(`${API}/v1/flows/notion.com`, () => HttpResponse.json(FLOW))
    )
    const result = await cli(['flows', 'list', '--slug', 'notion.com'])
    expect(result.code).toBe(0)
    expect(result.json).toEqual({ data: [FLOW], pagination: ONE_ROW })
  })
})
