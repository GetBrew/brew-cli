import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { analyticsAutomationsCommand } from '../../src/commands/analytics/automations'
import { analyticsCampaignsCommand } from '../../src/commands/analytics/campaigns'
import { analyticsEventsCommand } from '../../src/commands/analytics/events'
import { analyticsSendsGetCommand } from '../../src/commands/analytics/sends/get'
import { analyticsSendsListCommand } from '../../src/commands/analytics/sends/list'
import { analyticsTriggerInstancesListCommand } from '../../src/commands/analytics/trigger-instances/list'
import { brandGetCommand } from '../../src/commands/brand/get'
import { brandGetImagesCommand } from '../../src/commands/brand/get-images'
import { brandUpdateCommand } from '../../src/commands/brand/update'
import { contentAddImageCommand } from '../../src/commands/content/add-image'
import { contentGenerateImageCommand } from '../../src/commands/content/generate-image'
import { contentGifCommand } from '../../src/commands/content/gif'
import { contentHtmlToPngCommand } from '../../src/commands/content/html-to-png'
import { contentTransformCommand } from '../../src/commands/content/transform'
import { templatesListCommand } from '../../src/commands/templates/list'
import { server } from '../helpers/msw-server'
import { type RunCliResult, runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'

const EXTRA = [
  analyticsCampaignsCommand,
  analyticsAutomationsCommand,
  analyticsEventsCommand,
  analyticsSendsListCommand,
  analyticsSendsGetCommand,
  analyticsTriggerInstancesListCommand,
  brandGetCommand,
  brandUpdateCommand,
  brandGetImagesCommand,
  contentGenerateImageCommand,
  contentGifCommand,
  contentTransformCommand,
  contentHtmlToPngCommand,
  contentAddImageCommand,
  templatesListCommand,
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
const RANGE = { from: '2026-07-01T00:00:00Z', to: '2026-08-01T00:00:00Z' }

describe('analytics campaigns', () => {
  it('lists lifetime campaign KPIs', async () => {
    server.use(
      http.get(`${API}/v1/analytics/campaigns`, () =>
        HttpResponse.json({
          data: [{ sendId: 'snd_1', title: 'Launch', status: 'sent' }],
          pagination: PAGE_DONE,
        })
      )
    )
    const result = await cli(['analytics', 'campaigns'])
    expect(result.code).toBe(0)
    const data = result.json as { data: Array<{ sendId: string }> }
    expect(data.data[0]?.sendId).toBe('snd_1')
  })
})

describe('analytics automations', () => {
  it('maps --since/--until/--automation onto from/to/automationId', async () => {
    let query: URLSearchParams | undefined
    server.use(
      http.get(`${API}/v1/analytics/automations`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json({
          data: [],
          totals: { runs: 0 },
          range: RANGE,
        })
      })
    )
    const result = await cli([
      'analytics',
      'automations',
      '--since',
      '2026-07-01',
      '--until',
      '2026-08-01',
      '--automation',
      'am_1',
    ])
    expect(result.code).toBe(0)
    expect(query?.get('from')).toBe('2026-07-01')
    expect(query?.get('to')).toBe('2026-08-01')
    expect(query?.get('automationId')).toBe('am_1')
  })
})

describe('analytics events', () => {
  it('maps filter flags onto the query fields', async () => {
    let query: URLSearchParams | undefined
    server.use(
      http.get(`${API}/v1/analytics/events`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json({
          data: [{ id: 'evt_1', eventType: 'clicked', domain: 'email' }],
          pagination: PAGE_DONE,
          range: RANGE,
        })
      })
    )
    const result = await cli([
      'analytics',
      'events',
      '--since',
      '2026-08-01',
      '--until',
      '2026-08-10',
      '--recipient',
      'jane@example.com',
      '--event-type',
      'clicked',
      '--send',
      'snd_1',
    ])
    expect(result.code).toBe(0)
    expect(query?.get('from')).toBe('2026-08-01')
    expect(query?.get('to')).toBe('2026-08-10')
    expect(query?.get('recipientEmail')).toBe('jane@example.com')
    expect(query?.get('eventType')).toBe('clicked')
    expect(query?.get('sendId')).toBe('snd_1')
  })

  it('drains every page with --all', async () => {
    const pages = [
      {
        data: [{ id: 'evt_1' }],
        pagination: { limit: 1, cursor: 'c1', hasMore: true },
        range: RANGE,
      },
      {
        data: [{ id: 'evt_2' }],
        pagination: { limit: 1, cursor: null, hasMore: false },
        range: RANGE,
      },
    ]
    const cursors: Array<string | null> = []
    server.use(
      http.get(`${API}/v1/analytics/events`, ({ request }) => {
        cursors.push(new URL(request.url).searchParams.get('cursor'))
        return HttpResponse.json(pages[cursors.length - 1])
      })
    )
    const result = await cli(['analytics', 'events', '--all'])
    expect(result.code).toBe(0)
    expect(cursors).toEqual([null, 'c1'])
    const data = result.json as { data: unknown[] }
    expect(data.data).toHaveLength(2)
  })
})

describe('analytics sends list', () => {
  it('maps --send/--email/--include onto the query fields', async () => {
    let query: URLSearchParams | undefined
    server.use(
      http.get(`${API}/v1/analytics/sends`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json({
          data: [{ sendId: 'snd_1', kind: 'campaign', status: 'sent' }],
          pagination: PAGE_DONE,
        })
      })
    )
    const result = await cli([
      'analytics',
      'sends',
      'list',
      '--send',
      'snd_1',
      '--email',
      'em_1',
      '--include',
      'events',
    ])
    expect(result.code).toBe(0)
    expect(query?.get('sendId')).toBe('snd_1')
    expect(query?.get('emailId')).toBe('em_1')
    expect(query?.get('include')).toBe('events')
  })
})

describe('analytics sends get (derived)', () => {
  it('returns the single send', async () => {
    let query: URLSearchParams | undefined
    server.use(
      http.get(`${API}/v1/analytics/sends`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json({
          data: [{ sendId: 'snd_1', kind: 'campaign', status: 'sent' }],
        })
      })
    )
    const result = await cli(['analytics', 'sends', 'get', 'snd_1'])
    expect(result.code).toBe(0)
    expect(query?.get('sendId')).toBe('snd_1')
    expect((result.json as { sendId: string }).sendId).toBe('snd_1')
  })

  it('exits 1 with SEND_NOT_FOUND when missing', async () => {
    server.use(
      http.get(`${API}/v1/analytics/sends`, () =>
        HttpResponse.json({ data: [] })
      )
    )
    const result = await cli(['analytics', 'sends', 'get', 'snd_ghost'])
    expect(result.code).toBe(1)
    const parsed = JSON.parse(result.stderr) as { error: { code: string } }
    expect(parsed.error.code).toBe('SEND_NOT_FOUND')
  })
})

describe('analytics trigger-instances list', () => {
  it('filters by trigger event', async () => {
    let query: URLSearchParams | undefined
    server.use(
      http.get(`${API}/v1/analytics/trigger-instances`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json({
          data: [{ triggerInstanceId: 'ti_1', source: 'api', state: 'done' }],
          pagination: PAGE_DONE,
        })
      })
    )
    const result = await cli([
      'analytics',
      'trigger-instances',
      'list',
      '--trigger',
      'tev_1',
    ])
    expect(result.code).toBe(0)
    expect(query?.get('triggerEventId')).toBe('tev_1')
    const data = result.json as { data: Array<{ triggerInstanceId: string }> }
    expect(data.data[0]?.triggerInstanceId).toBe('ti_1')
  })
})

describe('brand get', () => {
  it('passes --include through as the comma query', async () => {
    let query: URLSearchParams | undefined
    server.use(
      http.get(`${API}/v1/brand`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json({
          brand: { name: 'Brew', status: 'completed', ready: true },
          identity: { brandName: 'Brew' },
          logos: [],
        })
      })
    )
    const result = await cli(['brand', 'get', '--include', 'identity,logos'])
    expect(result.code).toBe(0)
    expect(query?.get('include')).toBe('identity,logos')
    expect((result.json as { brand: { ready: boolean } }).brand.ready).toBe(
      true
    )
  })
})

describe('brand update', () => {
  it('requires --input', async () => {
    const result = await cli(['brand', 'update'])
    expect(result.code).toBe(2)
  })

  it('PATCHes the design context', async () => {
    let body: unknown
    server.use(
      http.patch(`${API}/v1/brand`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ brand: { name: 'Brew' } })
      })
    )
    const result = await cli([
      'brand',
      'update',
      '--input',
      '{"identity":{"tagline":"Brew better email"}}',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({ identity: { tagline: 'Brew better email' } })
  })
})

describe('brand get-images', () => {
  it('maps --query and --aspect-ratio onto q/aspectRatio', async () => {
    let query: URLSearchParams | undefined
    server.use(
      http.get(`${API}/v1/brand/images`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json({
          data: [{ url: 'https://cdn.brew.new/img.png' }],
          pagination: PAGE_DONE,
        })
      })
    )
    const result = await cli([
      'brand',
      'get-images',
      '--query',
      'team photo',
      '--aspect-ratio',
      '16:9',
    ])
    expect(result.code).toBe(0)
    expect(query?.get('q')).toBe('team photo')
    expect(query?.get('aspectRatio')).toBe('16:9')
  })
})

describe('content generate-image', () => {
  it('requires a prompt', async () => {
    const result = await cli(['content', 'generate-image'])
    expect(result.code).toBe(2)
  })

  it('sends the prompt body', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/content/generate-image`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ url: 'https://cdn.brew.new/gen.png' })
      })
    )
    const result = await cli([
      'content',
      'generate-image',
      '--prompt',
      'hero shot of a ceramic mug',
      '--aspect-ratio',
      '16:9',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({
      prompt: 'hero shot of a ceramic mug',
      aspectRatio: '16:9',
    })
  })
})

describe('content gif', () => {
  it('infers from: prompt for a prompt-only call', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/content/gif`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ url: 'https://cdn.brew.new/out.gif' })
      })
    )
    const result = await cli([
      'content',
      'gif',
      '--prompt',
      'steam rising from a coffee cup',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({
      from: 'prompt',
      prompt: 'steam rising from a coffee cup',
    })
  })
})

describe('content transform', () => {
  it('defaults to the optimize operation', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/content/transform`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          url: 'https://cdn.brew.new/opt.png',
          width: 1200,
          height: 630,
        })
      })
    )
    const result = await cli([
      'content',
      'transform',
      '--url',
      'https://cdn.example.com/hero.png',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({
      operation: 'optimize',
      imageUrl: 'https://cdn.example.com/hero.png',
    })
  })
})

describe('content html-to-png', () => {
  it('reads the HTML from --file', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/content/html-to-png`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          url: 'https://cdn.brew.new/render.png',
          width: 600,
        })
      })
    )
    const dir = mkdtempSync(join(tmpdir(), 'brew-cli-html-'))
    const htmlPath = join(dir, 'snippet.html')
    writeFileSync(htmlPath, '<p>Hello</p>')
    const result = await cli([
      'content',
      'html-to-png',
      '--file',
      htmlPath,
      '--width',
      '600',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({ html: '<p>Hello</p>', width: 600 })
  })
})

describe('content add-image', () => {
  it('mirrors the image URL', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/content/add-image`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          url: 'https://cdn.brew.new/mirrored.png',
          width: 800,
          height: 600,
          aspectRatio: '4:3',
        })
      })
    )
    const result = await cli([
      'content',
      'add-image',
      '--url',
      'https://cdn.example.com/logo.png',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({ imageUrl: 'https://cdn.example.com/logo.png' })
  })
})

describe('templates list', () => {
  it('maps gallery filters onto the query', async () => {
    let query: URLSearchParams | undefined
    server.use(
      http.get(`${API}/v1/templates`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json({
          data: [{ emailId: 'em_1', title: 'Welcome', category: 'welcome' }],
          pagination: PAGE_DONE,
        })
      })
    )
    const result = await cli([
      'templates',
      'list',
      '--brand-name',
      'Brew',
      '--category',
      'welcome',
      '--semantic',
      'minimal launch',
    ])
    expect(result.code).toBe(0)
    expect(query?.get('brand')).toBe('Brew')
    expect(query?.get('category')).toBe('welcome')
    expect(query?.get('semantic')).toBe('minimal launch')
    const data = result.json as { data: Array<{ emailId: string }> }
    expect(data.data[0]?.emailId).toBe('em_1')
  })
})

describe('content transform operation inference', () => {
  it('infers resize when sizing knobs are present without --operation', async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.post(
        'https://brew.new/api/v1/content/transform',
        async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({
            imageUrl: 'https://cdn.example.com/out.png',
          })
        }
      )
    )
    const result = await cli([
      'content',
      'transform',
      '--url',
      'https://cdn.example.com/hero.png',
      '--width',
      '1200',
      '--height',
      '630',
    ])
    expect(result.code).toBe(0)
    expect(body?.operation).toBe('resize')
    expect(body?.width).toBe(1200)
  })

  it('defaults to optimize for a bare URL', async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.post(
        'https://brew.new/api/v1/content/transform',
        async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({
            imageUrl: 'https://cdn.example.com/out.png',
          })
        }
      )
    )
    const result = await cli([
      'content',
      'transform',
      '--url',
      'https://cdn.example.com/hero.png',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({
      operation: 'optimize',
      imageUrl: 'https://cdn.example.com/hero.png',
    })
  })
})
