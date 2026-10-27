import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const env = () => ({
  BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-webhooks-')),
  BREW_API_KEY: 'brew_abcdefghijklmnopqrstuvwxyz012345',
  BREW_BRAND_ID: 'brand_1',
})
it.each([
  {
    args: ['list', '--limit', '2', '--cursor', 'next'],
    method: 'GET',
    path: '/api/v1/webhooks',
  },
  { args: ['get', 'ep_1'], method: 'GET', path: '/api/v1/webhooks/ep_1' },
  {
    args: ['update', 'ep_1', '--input', '{"status":"disabled"}'],
    method: 'PATCH',
    path: '/api/v1/webhooks/ep_1',
  },
  {
    args: ['delete', 'ep_1', '--yes'],
    method: 'DELETE',
    path: '/api/v1/webhooks/ep_1',
  },
  {
    args: ['rotate-secret', 'ep_1', '--yes'],
    method: 'POST',
    path: '/api/v1/webhooks/ep_1/rotate-secret',
  },
  {
    args: ['events', 'ep_1', '--limit', '2'],
    method: 'GET',
    path: '/api/v1/webhooks/ep_1/events',
  },
  {
    args: ['attempts', 'ep_1', 'msg_1'],
    method: 'GET',
    path: '/api/v1/webhooks/ep_1/events/msg_1/attempts',
  },
  {
    args: ['test', 'ep_1', '--yes', '--input', '{"type":"email.delivered"}'],
    method: 'POST',
    path: '/api/v1/webhooks/ep_1/test',
  },
])(
  'binds $args to $method $path with verified brand selection',
  async ({ args, method, path }) => {
    const seen: Array<{
      method: string
      path: string
      brand: string | null
      key: string | null
      body: unknown
      limit: string | null
    }> = []
    server.use(
      http.all(
        /https:\/\/brew\.new\/api\/v1\/webhooks/,
        async ({ request }) => {
          const url = new URL(request.url)
          seen.push({
            method: request.method,
            path: url.pathname,
            brand: request.headers.get('X-Brand-Id'),
            key: request.headers.get('Idempotency-Key'),
            body: ['POST', 'PATCH'].includes(request.method)
              ? await request.json()
              : undefined,
            limit: url.searchParams.get('limit'),
          })
          return HttpResponse.json({ id: 'ep_1' })
        }
      )
    )
    const result = await runCli(['webhooks', ...args, '--json'], { env: env() })
    expect(result.code).toBe(0)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ method, path, brand: 'brand_1' })
    if (method === 'POST') expect(seen[0]?.key).toBeTruthy()
    if (args.includes('--limit')) expect(seen[0]?.limit).toBe('2')
    if (args[0] === 'update')
      expect(seen[0]?.body).toEqual({ status: 'disabled' })
  }
)
it.each(['delete', 'rotate-secret', 'test'])(
  'requires confirmation before %s can contact the provider',
  async (command) => {
    const result = await runCli(['webhooks', command, 'ep_1', '--json'], {
      env: env(),
    })
    expect(result.code).toBe(4)
  }
)
it('rejects path identities injected into a write body', async () => {
  const result = await runCli(
    [
      'webhooks',
      'update',
      'ep_1',
      '--input',
      '{"webhookId":"ep_other"}',
      '--json',
    ],
    { env: env() }
  )
  expect(result.code).toBe(2)
})
it('creates an endpoint with brand scope and an idempotency key', async () => {
  let body: unknown
  let key: string | null = null
  server.use(
    http.post('https://brew.new/api/v1/webhooks', async ({ request }) => {
      body = await request.json()
      key = request.headers.get('Idempotency-Key')
      return HttpResponse.json({ id: 'ep_1' }, { status: 201 })
    })
  )
  const result = await runCli(
    [
      'webhooks',
      'create',
      '--input',
      JSON.stringify({
        endpoint: 'https://example.com/hook',
        events: ['email.delivered'],
      }),
      '--json',
    ],
    { env: env() }
  )
  expect(result.code).toBe(0)
  expect(body).toEqual({
    endpoint: 'https://example.com/hook',
    events: ['email.delivered'],
  })
  expect(key).toBeTruthy()
})
it('requires confirmation for replay and posts only a webhook request after confirmation', async () => {
  const options = { env: env() }
  const refused = await runCli(
    ['webhooks', 'replay', 'ep_1', 'msg_1', '--json'],
    options
  )
  expect(refused.code).toBe(4)
  server.use(
    http.post('https://brew.new/api/v1/webhooks/ep_1/events/msg_1/replay', () =>
      HttpResponse.json({ id: 'msg_1', accepted: true }, { status: 202 })
    )
  )
  const result = await runCli(
    ['webhooks', 'replay', 'ep_1', 'msg_1', '--yes', '--json'],
    options
  )
  expect(result.code).toBe(0)
  expect(result.json).toEqual({ id: 'msg_1', accepted: true })
})
