import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { type RunCliResult, runCli } from '../helpers/run-cli'

/**
 * The v1 cleanup's new bindings: the per-collection detail reads, the sends
 * root, the contact list, trigger instances, and the audience-run resume
 * action. Each asserts the exact route the command must hit — these are the
 * routes that replaced the old list-with-an-id-filter trick.
 */

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const API = 'https://brew.new/api'

function cli(argv: readonly string[]): Promise<RunCliResult> {
  return runCli(argv, {
    env: {
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
      BREW_API_KEY: KEY,
    },
  })
}

const PAGE_DONE = { limit: 100, cursor: null, hasMore: false }

describe('sends list', () => {
  it('maps the join-key and window flags onto the sends-root query', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/sends`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          data: [{ sendId: 'snd_1', kind: 'automation', status: 'running' }],
          pagination: PAGE_DONE,
        })
      })
    )
    const result = await cli([
      'sends',
      'list',
      '--automation-run',
      'run_1',
      '--status',
      'running',
      '--message-class',
      'marketing',
      '--since',
      '2026-08-01T00:00:00Z',
    ])
    expect(result.code).toBe(0)
    expect(url?.pathname).toBe('/api/v1/sends')
    expect(url?.searchParams.get('automationRunId')).toBe('run_1')
    expect(url?.searchParams.get('status')).toBe('running')
    expect(url?.searchParams.get('messageClass')).toBe('marketing')
    expect(url?.searchParams.get('from')).toBe('2026-08-01T00:00:00Z')
  })
})

describe('sends get', () => {
  it('reads the detail route and returns the bare row', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/sends/snd_1`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ sendId: 'snd_1', status: 'completed' })
      })
    )
    const result = await cli(['sends', 'get', 'snd_1', '--include', 'events'])
    expect(result.code).toBe(0)
    expect(url?.pathname).toBe('/api/v1/sends/snd_1')
    expect(url?.searchParams.get('include')).toBe('events')
    expect((result.json as { sendId: string }).sendId).toBe('snd_1')
  })
})

describe('contacts list', () => {
  it('maps --search/--audience/--sort onto the contact list query', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/contacts`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          data: [{ email: 'jane@example.com' }],
          pagination: PAGE_DONE,
        })
      })
    )
    const result = await cli([
      'contacts',
      'list',
      '--search',
      'acme',
      '--audience',
      'aud_1',
      '--sort',
      'email',
      '--order',
      'asc',
    ])
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('search')).toBe('acme')
    expect(url?.searchParams.get('audienceId')).toBe('aud_1')
    expect(url?.searchParams.get('sort')).toBe('email')
    expect(url?.searchParams.get('order')).toBe('asc')
  })
})

describe('fields get', () => {
  it('reads one field definition by name', async () => {
    let requestedPath: string | undefined
    server.use(
      http.get(`${API}/v1/fields/loyalty_tier`, ({ request }) => {
        requestedPath = new URL(request.url).pathname
        return HttpResponse.json({
          fieldName: 'loyalty_tier',
          fieldType: 'string',
        })
      })
    )
    const result = await cli(['fields', 'get', 'loyalty_tier'])
    expect(result.code).toBe(0)
    expect(requestedPath).toBe('/api/v1/fields/loyalty_tier')
    expect((result.json as { fieldName: string }).fieldName).toBe(
      'loyalty_tier'
    )
  })
})

describe('emails groups get', () => {
  it('reads the Ungrouped catalog row by its literal id', async () => {
    let requestedPath: string | undefined
    server.use(
      http.get(`${API}/v1/email-groups/ungrouped`, ({ request }) => {
        requestedPath = new URL(request.url).pathname
        return HttpResponse.json({
          groupId: 'ungrouped',
          groupName: 'Ungrouped',
          emailCount: 3,
        })
      })
    )
    const result = await cli(['emails', 'groups', 'get', 'ungrouped'])
    expect(result.code).toBe(0)
    expect(requestedPath).toBe('/api/v1/email-groups/ungrouped')
    expect((result.json as { emailCount: number }).emailCount).toBe(3)
  })
})

describe('automations runs get', () => {
  it('reads one run and passes --include logs', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/automations/runs/run_1`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          automationRunId: 'run_1',
          status: 'completed',
        })
      })
    )
    const result = await cli([
      'automations',
      'runs',
      'get',
      'run_1',
      '--include',
      'logs',
    ])
    expect(result.code).toBe(0)
    expect(url?.pathname).toBe('/api/v1/automations/runs/run_1')
    expect(url?.searchParams.get('include')).toBe('logs')
  })
})

describe('automations audience-runs get', () => {
  it('reads one manual-audience run', async () => {
    let requestedPath: string | undefined
    server.use(
      http.get(`${API}/v1/automations/audience-runs/arun_1`, ({ request }) => {
        requestedPath = new URL(request.url).pathname
        return HttpResponse.json({
          audienceRunId: 'arun_1',
          status: 'paused',
        })
      })
    )
    const result = await cli(['automations', 'audience-runs', 'get', 'arun_1'])
    expect(result.code).toBe(0)
    expect(requestedPath).toBe('/api/v1/automations/audience-runs/arun_1')
  })
})

describe('automations audience-runs resume', () => {
  it('posts to the resume action sub-path and reports resumedFrom', async () => {
    let requestedPath: string | undefined
    server.use(
      http.post(
        `${API}/v1/automations/audience-runs/arun_1/resume`,
        ({ request }) => {
          requestedPath = new URL(request.url).pathname
          return HttpResponse.json({
            audienceRunId: 'arun_1',
            status: 'running',
            resumedFrom: 'paused',
          })
        }
      )
    )
    const result = await cli([
      'automations',
      'audience-runs',
      'resume',
      'arun_1',
    ])
    expect(result.code).toBe(0)
    expect(requestedPath).toBe(
      '/api/v1/automations/audience-runs/arun_1/resume'
    )
    expect((result.json as { resumedFrom: string }).resumedFrom).toBe('paused')
  })
})

describe('automations trigger-instances', () => {
  it('lists instances under automations', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/automations/trigger-instances`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          data: [{ triggerInstanceId: 'tin_1', state: 'matched' }],
          pagination: PAGE_DONE,
        })
      })
    )
    const result = await cli([
      'automations',
      'trigger-instances',
      'list',
      '--trigger',
      'tri_1',
    ])
    expect(result.code).toBe(0)
    expect(url?.pathname).toBe('/api/v1/automations/trigger-instances')
    expect(url?.searchParams.get('triggerEventId')).toBe('tri_1')
  })

  it('reads one instance by id', async () => {
    let requestedPath: string | undefined
    server.use(
      http.get(
        `${API}/v1/automations/trigger-instances/tin_1`,
        ({ request }) => {
          requestedPath = new URL(request.url).pathname
          return HttpResponse.json({
            triggerInstanceId: 'tin_1',
            automationRunIds: ['run_1'],
          })
        }
      )
    )
    const result = await cli([
      'automations',
      'trigger-instances',
      'get',
      'tin_1',
    ])
    expect(result.code).toBe(0)
    expect(requestedPath).toBe('/api/v1/automations/trigger-instances/tin_1')
  })
})

describe('automations triggers get', () => {
  it('reads one trigger and passes --include skill', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/automations/triggers/tri_1`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          triggerEventId: 'tri_1',
          title: 'Signup',
          payloadSchema: {},
        })
      })
    )
    const result = await cli([
      'automations',
      'triggers',
      'get',
      'tri_1',
      '--include',
      'skill',
    ])
    expect(result.code).toBe(0)
    expect(url?.pathname).toBe('/api/v1/automations/triggers/tri_1')
    expect(url?.searchParams.get('include')).toBe('skill')
  })
})
