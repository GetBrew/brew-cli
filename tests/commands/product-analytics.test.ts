import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const API = 'https://brew.new/api'
const event = {
  schemaVersion: 1,
  id: 'order-123',
  type: 'track',
  name: 'order_completed',
  occurredAt: '2026-10-28T12:00:00Z',
  anonymousId: 'anon-1',
  sessionId: 'session-1',
  tabId: 'server',
  pageViewId: 'server',
  properties: { total: 4900 },
  context: {},
  sdk: { name: 'orders', version: '1.0.0' },
}
const cli = (argv: readonly string[], stdin?: string) =>
  runCli(argv, {
    env: {
      BREW_API_KEY: 'brew_abcdefghijklmnopqrstuvwxyz012345',
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-analytics-')),
    },
    ...(stdin === undefined ? {} : { stdin }),
  })

describe('product analytics commands', () => {
  it('requires confirmation before ingesting events that can start live flows', async () => {
    const result = await cli([
      'analytics',
      'track',
      '--project-id',
      'project-1',
      '--input',
      JSON.stringify({ events: [event] }),
    ])
    expect(result.code).toBe(4)
    expect(result.json).toMatchObject({
      confirmationRequired: true,
      confirmCommand: expect.stringContaining('--yes'),
    })
  })

  it('posts the canonical batch with brand scope and a stable retry key', async () => {
    let body: unknown
    let headers: Headers | undefined
    const response = { accepted: [event.id], rejected: [] }
    server.use(
      http.post(`${API}/v1/analytics/track`, async ({ request }) => {
        body = await request.json()
        headers = request.headers
        return HttpResponse.json(response, { status: 202 })
      })
    )
    const result = await cli(
      [
        'analytics',
        'track',
        '--project-id',
        'project-1',
        '--input',
        '-',
        '--brand',
        'brand-1',
        '--idempotency-key',
        'order:123',
        '--yes',
      ],
      JSON.stringify({ events: [event] })
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ projectId: 'project-1', events: [event] })
    expect(headers?.get('x-brand-id')).toBe('brand-1')
    expect(headers?.get('idempotency-key')).toBe('order:123')
    expect(result.json).toEqual(response)
  })

  it('issues an identity token without an idempotency key or consent mutation', async () => {
    let body: unknown
    let headers: Headers | undefined
    const response = {
      token: 'synthetic-token',
      expiresAt: '2026-10-28T12:05:00Z',
    }
    server.use(
      http.post(`${API}/v1/analytics/identity-token`, async ({ request }) => {
        body = await request.json()
        headers = request.headers
        return HttpResponse.json(response)
      })
    )
    const result = await cli([
      'analytics',
      'identity-token',
      '--project-id',
      'project-1',
      '--user-id',
      'user-1',
      '--anonymous-id',
      'anon-1',
      '--contact-id',
      '507f1f77bcf86cd799439011',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({
      projectId: 'project-1',
      userId: 'user-1',
      anonymousId: 'anon-1',
      contactId: '507f1f77bcf86cd799439011',
    })
    expect(headers?.get('idempotency-key')).toBeNull()
    expect(result.json).toEqual(response)
  })
})
