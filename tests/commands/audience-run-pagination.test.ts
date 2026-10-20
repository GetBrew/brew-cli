import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const API = 'https://brew.new/api'
const command = (options: { all?: boolean; ttyOut?: boolean } = {}) =>
  runCli(
    [
      'automations',
      'audience-runs',
      'list',
      ...(options.all === false ? [] : ['--all']),
    ],
    {
      ...(options.ttyOut === undefined ? {} : { ttyOut: options.ttyOut }),
      env: {
        BREW_CLI_CONFIG_DIR: mkdtempSync(
          join(tmpdir(), 'brew-cli-pagination-')
        ),
        BREW_API_KEY: 'brew_abcdefghijklmnopqrstuvwxyz012345',
        BREW_BRAND_ID: 'kx7b3s7fapqz8mjm12ekz1kxdx87yceg',
      },
    }
  )

describe('audience history pagination', () => {
  it('explains how to continue an empty filtered page on a terminal', async () => {
    server.use(
      http.get(`${API}/v1/automations/audience-runs`, () =>
        HttpResponse.json({
          data: [],
          pagination: { limit: 100, cursor: 'sparse', hasMore: true },
        })
      )
    )
    const result = await command({ all: false, ttyOut: true })
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('No matching audience runs on this page.')
    expect(result.stdout).toContain('--cursor sparse')
    expect(result.stdout).toContain('--all')
    expect(result.stdout).not.toContain('No audience runs found.')
  })
  it('fails a stalled cursor without printing a partial list as complete', async () => {
    let requests = 0
    server.use(
      http.get(`${API}/v1/automations/audience-runs`, () => {
        requests += 1
        return HttpResponse.json({
          data: [{ audienceRunId: 'run_1', status: 'running' }],
          pagination: { limit: 100, cursor: 'stalled', hasMore: true },
        })
      })
    )
    const result = await command()
    expect(result.code).toBe(1)
    expect(result.stdout).toBe('')
    const envelope = JSON.parse(
      result.stderr.trim().split('\n').at(-1) ?? ''
    ) as {
      error: {
        code: string
        progress: {
          rowsFetched: number
          pagesFetched: number
          resumeCursor: string
        }
      }
    }
    expect(envelope.error).toMatchObject({
      code: 'CLI_PAGINATION',
      progress: { rowsFetched: 2, pagesFetched: 2 },
    })
    expect(envelope.error.progress).not.toHaveProperty('resumeCursor')
    expect(requests).toBe(2)
  })

  it('continues sparse history pages until the cursor is exhausted', async () => {
    const cursors: Array<string | null> = []
    server.use(
      http.get(`${API}/v1/automations/audience-runs`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        cursors.push(cursor)
        return HttpResponse.json(
          cursor === null
            ? {
                data: [],
                pagination: { limit: 100, cursor: 'sparse', hasMore: true },
              }
            : {
                data: [{ audienceRunId: 'old_active', status: 'running' }],
                pagination: { limit: 100, cursor: null, hasMore: false },
              }
        )
      })
    )
    const result = await command()
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: [{ audienceRunId: 'old_active' }],
    })
    expect(cursors).toEqual([null, 'sparse'])
  })
})
