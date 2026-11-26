import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const URL = 'https://brew.new/api/v1/email-migrations'
const input = {
  capabilityGrantId: 'grant_marketing_emails',
  items: [{ sourceId: '12345', expectedRevision: 'revision-1' }],
  dryRun: true,
}
const view = {
  migrationId: 'emigration_123',
  capabilityGrantId: input.capabilityGrantId,
  dryRun: true,
  status: 'held',
  leaseExpiresAt: 1795802400000,
  nextIndex: 0,
  total: 1,
  outcomes: [],
  hold: { sourceId: '12345', reason: 'rate-limited', retryAt: 1795802400000 },
  limitations: ['hosted-copy-may-differ', 'delivery-records-not-included'],
  nextAction: 'resume',
}
function env() {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-migration-')),
    BREW_API_KEY: KEY,
    BREW_BRAND_ID: 'brand_marketing',
  }
}

describe('email-migrations', () => {
  it('starts a scoped dry-run by default and passes the same retry identity to the SDK', async () => {
    let body: unknown
    let headers: Headers | undefined
    server.use(
      http.post(URL, async ({ request }) => {
        body = await request.json()
        headers = request.headers
        return HttpResponse.json(view, { status: 202 })
      })
    )
    const result = await runCli(
      [
        'email-migrations',
        'start',
        '--source-ids',
        '12345',
        '--idempotency-key',
        'migration-review-1',
      ],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ items: [{ sourceId: '12345' }], dryRun: true })
    expect(headers?.get('authorization')).toBe(`Bearer ${KEY}`)
    expect(headers?.get('x-brand-id')).toBe('brand_marketing')
    expect(headers?.get('idempotency-key')).toBe('migration-review-1')
    expect(result.json).toEqual(view)
  })

  it('preserves exact source revisions from stdin while flags override request scalars', async () => {
    let body: unknown
    server.use(
      http.post(URL, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(view)
      })
    )
    const result = await runCli(
      [
        'email-migrations',
        'start',
        '--input',
        '-',
        '--target-group',
        'group_imported',
        '--dry-run',
      ],
      { env: env(), stdin: JSON.stringify({ ...input, dryRun: false }) }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({
      ...input,
      dryRun: true,
      targetGroupId: 'group_imported',
    })
  })

  it('uses the explicitly selected connection without changing the approved source revisions', async () => {
    let body: unknown
    server.use(
      http.post(URL, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          ...view,
          capabilityGrantId: 'grant_reviewed',
        })
      })
    )
    const result = await runCli(
      [
        'email-migrations',
        'start',
        '--input',
        JSON.stringify(input),
        '--capability-grant-id',
        'grant_reviewed',
      ],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ ...input, capabilityGrantId: 'grant_reviewed' })
    expect(result.json).toMatchObject({ capabilityGrantId: 'grant_reviewed' })
  })

  it('returns ambiguous connection choices without retrying or choosing a grant', async () => {
    let calls = 0
    server.use(
      http.post(URL, () => {
        calls += 1
        return HttpResponse.json(
          {
            error: {
              code: 'EMAIL_MIGRATION_CONFLICT',
              type: 'conflict',
              message:
                'Multiple ready HubSpot marketing-email connections are available. Retry with capabilityGrantId: grant_a (account 123); grant_b (account 456).',
            },
          },
          { status: 409 }
        )
      })
    )
    const result = await runCli(
      ['email-migrations', 'start', '--source-ids', '12345'],
      { env: env() }
    )
    expect(result.code).toBe(1)
    expect(calls).toBe(1)
    expect(JSON.parse(result.stderr)).toMatchObject({
      error: {
        code: 'EMAIL_MIGRATION_CONFLICT',
        status: 409,
        message: expect.stringContaining(
          'grant_a (account 123); grant_b (account 456)'
        ),
      },
    })
  })

  it('rejects tenant authority supplied through the migration body before transport', async () => {
    let calls = 0
    server.use(
      http.post(URL, () => {
        calls += 1
        return HttpResponse.json(view)
      })
    )
    for (const authority of [
      { orgId: 'org_other' },
      { brandId: 'brand_other' },
    ]) {
      const result = await runCli(
        [
          'email-migrations',
          'start',
          '--input',
          JSON.stringify({ ...input, ...authority }),
        ],
        { env: env() }
      )
      expect(result.code).toBe(2)
      expect(result.stderr).toContain('Unknown --input')
    }
    expect(calls).toBe(0)
  })

  it('starts the approved import only when execution is explicitly requested', async () => {
    let body: unknown
    server.use(
      http.post(URL, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ...view, dryRun: false })
      })
    )
    const result = await runCli(
      [
        'email-migrations',
        'start',
        '--input',
        JSON.stringify(input),
        '--execute',
      ],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ ...input, dryRun: false })
  })

  it('rejects conflicting modes and missing inventory before transport', async () => {
    for (const args of [
      ['--source-ids', '1', '--dry-run', '--execute'],
      ['--capability-grant-id', 'grant'],
    ]) {
      expect(
        (await runCli(['email-migrations', 'start', ...args], { env: env() }))
          .code
      ).toBe(2)
    }
  })

  it('encodes migration IDs and keeps the selected brand on read requests', async () => {
    let pathname: string | undefined
    let brand: string | null = null
    server.use(
      http.get(`${URL}/*`, ({ request }) => {
        pathname = new globalThis.URL(request.url).pathname
        brand = request.headers.get('x-brand-id')
        return HttpResponse.json(view)
      })
    )
    const result = await runCli(
      ['email-migrations', 'get', 'emigration_a/b?x'],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(pathname).toBe('/api/v1/email-migrations/emigration_a%2Fb%3Fx')
    expect(brand).toBe('brand_marketing')
    expect(result.json).toEqual(view)
  })

  it('resumes the existing migration without rebuilding or changing its original plan', async () => {
    let requestBody = ''
    let idempotency: string | null = null
    server.use(
      http.post(`${URL}/emigration_123/resume`, async ({ request }) => {
        requestBody = await request.text()
        idempotency = request.headers.get('idempotency-key')
        return HttpResponse.json(
          { ...view, status: 'running', nextAction: 'wait' },
          { status: 202 }
        )
      })
    )
    const result = await runCli(
      [
        'email-migrations',
        'resume',
        'emigration_123',
        '--idempotency-key',
        'resume-review-1',
      ],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(requestBody === '' || requestBody === '{}').toBe(true)
    expect(idempotency).toBe('resume-review-1')
    expect(result.json).toMatchObject({
      migrationId: 'emigration_123',
      dryRun: true,
      status: 'running',
    })
  })

  it('requires confirmation before canceling and preserves retry scope in the rerun', async () => {
    const result = await runCli(
      [
        'email-migrations',
        'cancel',
        'emigration_123',
        '--brand',
        'brand_review',
        '--idempotency-key',
        'cancel-review-1',
      ],
      { env: env() }
    )
    expect(result.code).toBe(4)
    expect(result.json).toMatchObject({
      confirmationRequired: true,
      command: 'brew-cli email-migrations cancel',
    })
    expect(result.json).toHaveProperty(
      'confirmCommand',
      expect.stringContaining('--brand=brand_review')
    )
    expect(result.json).toHaveProperty(
      'confirmCommand',
      expect.stringContaining('--idempotency-key=cancel-review-1')
    )
  })

  it('cancels only the named job after confirmation and does not erase imported designs', async () => {
    let calls = 0
    server.use(
      http.post(`${URL}/emigration_123/cancel`, ({ request }) => {
        calls += 1
        expect(request.headers.get('x-brand-id')).toBe('brand_marketing')
        expect(request.headers.get('idempotency-key')).toBe('cancel-review-1')
        return HttpResponse.json({
          ...view,
          status: 'canceled',
          nextAction: 'none',
          outcomes: [
            {
              sourceId: '12345',
              status: 'imported',
              emailId: 'email_1',
              emailVersionId: 'version_1',
            },
          ],
        })
      })
    )
    const result = await runCli(
      [
        'email-migrations',
        'cancel',
        'emigration_123',
        '--yes',
        '--idempotency-key',
        'cancel-review-1',
      ],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(calls).toBe(1)
    expect(result.json).toMatchObject({
      status: 'canceled',
      outcomes: [{ emailId: 'email_1', emailVersionId: 'version_1' }],
    })
  })

  it('keeps unauthenticated calls away from the API', async () => {
    const result = await runCli(['email-migrations', 'get', 'emigration_123'], {
      env: {
        BREW_CLI_CONFIG_DIR: mkdtempSync(
          join(tmpdir(), 'brew-cli-migration-anonymous-')
        ),
      },
    })
    expect(result.code).toBe(3)
  })

  it('exposes all four typed commands and routes in the machine manifest', async () => {
    const result = await runCli(['docs', '--agent'])
    expect(result.code).toBe(0)
    const manifest = result.json as {
      commands: Array<{
        sdkMethod: string
        route: string
        confirmation: boolean
      }>
    }
    expect(
      manifest.commands.filter((command) =>
        command.sdkMethod?.startsWith('emailMigrations.')
      )
    ).toEqual([
      expect.objectContaining({
        sdkMethod: 'emailMigrations.start',
        route: 'POST /v1/email-migrations',
        confirmation: false,
      }),
      expect.objectContaining({
        sdkMethod: 'emailMigrations.get',
        route: 'GET /v1/email-migrations/{migrationId}',
        confirmation: false,
      }),
      expect.objectContaining({
        sdkMethod: 'emailMigrations.resume',
        route: 'POST /v1/email-migrations/{migrationId}/resume',
        confirmation: false,
      }),
      expect.objectContaining({
        sdkMethod: 'emailMigrations.cancel',
        route: 'POST /v1/email-migrations/{migrationId}/cancel',
        confirmation: true,
      }),
    ])
  })
})
