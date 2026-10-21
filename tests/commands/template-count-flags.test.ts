import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const env = { BREW_API_KEY: 'brew_abcdefghijklmnopqrstuvwxyz012345' }

describe('template count flags', () => {
  it('sends typed count and grouping flags and prints the count response', async () => {
    let url: URL | undefined
    const body = {
      count: 42,
      groupBy: 'category',
      groups: [{ value: 'newsletter', count: 42 }],
      pagination: { limit: 20, cursor: null, hasMore: false },
    }
    server.use(
      http.get('https://brew.new/api/v1/templates', ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json(body)
      })
    )
    const result = await runCli(
      ['templates', 'list', '--count', '--group-by', 'category'],
      { env }
    )
    expect(result.code).toBe(0)
    expect(result.json).toEqual(body)
    expect(url?.searchParams.get('count')).toBe('true')
    expect(url?.searchParams.get('groupBy')).toBe('category')
  })

  it('refuses --all for counts before sending a request', async () => {
    const result = await runCli(['templates', 'list', '--count', '--all'], {
      env,
    })
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('--all pages through rows')
  })

  it('filters browse groups and labels group counts in human output', async () => {
    let url: URL | undefined
    server.use(
      http.get('https://brew.new/api/v1/templates', ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          count: 42,
          groupBy: 'group',
          groupCount: 1,
          groups: [{ value: 'events', name: 'Events', count: 42 }],
          pagination: { limit: 20, cursor: null, hasMore: false },
        })
      })
    )
    const result = await runCli(
      [
        'templates',
        'list',
        '--group',
        'events',
        '--count',
        '--group-by',
        'group',
      ],
      { env, ttyOut: true }
    )
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('group')).toBe('events')
    expect(url?.searchParams.get('groupBy')).toBe('group')
    expect(result.stdout).toContain('GROUP')
    expect(result.stdout).toContain('Events')
    expect(result.stdout).toContain('1 group')
    expect(result.stdout).not.toContain('1 groups')
    expect(result.stdout).not.toContain('BRAND')
    expect(result.stdout).not.toContain('brands')
  })
})
