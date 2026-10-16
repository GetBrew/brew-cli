import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import type { components } from '../../src/generated/openapi-types'
import { server } from '../helpers/msw-server'
import { type RunCliOptions, runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const API = 'https://brew.new/api'

function cli(argv: readonly string[], options: RunCliOptions = {}) {
  return runCli(argv, {
    ...options,
    env: {
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
      BREW_API_KEY: KEY,
      ...options.env,
    },
  })
}

type FireAccepted = components['schemas']['TriggerFireAccepted']
type AppEmailRow = components['schemas']['AppEmailRow']
type SetupResult = components['schemas']['AppEmailSetupResult']

const ACCEPTED: FireAccepted = {
  triggerInstanceId: 'tin_1',
  triggerEventId: 'tri_reset',
  triggerKey: 'auth.password-reset',
  status: 'triggered',
  automationRunIds: ['run_1'],
  notStarted: [],
  publishedAutomations: [{ automationId: 'aut_1' }],
  counts: { automations: 1, skipped: 0 },
  warnings: [],
  receivedAt: '2026-10-13T10:00:00.000Z',
}

const ROW: AppEmailRow = {
  triggerKey: 'auth.password-reset',
  triggerEventId: 'tri_reset',
  title: 'Password reset',
  emailId: 'eml_1',
  automationId: 'aut_1',
  starterId: 'auth.password-reset',
  starterVersion: 1,
  upgradeAvailable: false,
  published: true,
  sender: { mode: 'sandbox' },
  readiness: { ready: true, teamOnly: true, blockers: [] },
  updatedAt: '2026-10-13T10:00:00.000Z',
}

const SETUP: SetupResult = {
  triggerKey: 'auth.password-reset',
  triggerEventId: 'tri_reset',
  emailId: 'eml_1',
  emailVersionId: 'emv_1',
  automationId: 'aut_1',
  published: true,
  created: { trigger: true, email: true, automation: true },
  sender: {
    mode: 'sandbox',
    from: 'hello@email.brew.new',
    sandbox: { dailyLimit: 50, remainingToday: 50 },
  },
  payloadSchema: {
    type: 'object',
    fields: [{ key: 'email', type: 'string', required: true }],
  },
  fireExample: {
    method: 'POST',
    path: '/v1/automations/triggers/by-key/auth.password-reset/fire',
    examplePayload: { email: 'jane@example.com' },
    curl: 'curl …',
    sdk: "await brew.send('auth.password-reset', { email })",
  },
  warnings: [],
}

describe('send', () => {
  it('exits 4 with a summary naming the key and recipient when unconfirmed', async () => {
    const result = await cli([
      'send',
      'auth.password-reset',
      '--to',
      'jane@example.com',
    ])
    expect(result.code).toBe(4)
    const envelope = result.json as {
      summary: string
      confirmCommand: string
    }
    expect(envelope.summary).toContain(
      'auth.password-reset to jane@example.com'
    )
    expect(envelope.summary).toContain('REAL')
    expect(envelope.confirmCommand).toBe(
      'brew-cli send auth.password-reset --to jane@example.com --yes'
    )
  })

  it('fires by key with --to merged over --data, forwarding the idempotency key', async () => {
    let body: unknown
    let idempotency: string | null = null
    server.use(
      http.post(
        `${API}/v1/automations/triggers/by-key/auth.password-reset/fire`,
        async ({ request }) => {
          body = await request.json()
          idempotency = request.headers.get('idempotency-key')
          return HttpResponse.json(ACCEPTED, { status: 202 })
        }
      )
    )
    const result = await cli([
      'send',
      'auth.password-reset',
      '--to',
      'jane@example.com',
      '--data',
      '{"email":"old@example.com","userName":"Jane"}',
      '--idempotency-key',
      'reset:abc',
      '--yes',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({
      payload: { email: 'jane@example.com', userName: 'Jane' },
    })
    expect(idempotency).toBe('reset:abc')
    expect(result.json).toEqual(ACCEPTED)
  })

  it('reads the payload from stdin with --data -', async () => {
    let body: unknown
    server.use(
      http.post(
        `${API}/v1/automations/triggers/by-key/order.paid/fire`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json(
            { ...ACCEPTED, triggerKey: 'order.paid' },
            { status: 202 }
          )
        }
      )
    )
    const result = await cli(['send', 'order.paid', '--data', '-', '--yes'], {
      stdin: '{"email":"jane@example.com","orderId":"ord_1"}',
    })
    expect(result.code).toBe(0)
    expect(body).toEqual({
      payload: { email: 'jane@example.com', orderId: 'ord_1' },
    })
  })

  it('renders a one-line human summary on a TTY', async () => {
    server.use(
      http.post(
        `${API}/v1/automations/triggers/by-key/auth.password-reset/fire`,
        () => HttpResponse.json(ACCEPTED, { status: 202 })
      )
    )
    const result = await cli(
      ['send', 'auth.password-reset', '--to', 'jane@example.com', '--yes'],
      { ttyOut: true }
    )
    expect(result.code).toBe(0)
    expect(result.stdout).toBe(
      'Sent auth.password-reset: 1 run started (instance tin_1).\n'
    )
  })

  it('refuses a send with no recipient (exit 2, no request)', async () => {
    const result = await cli([
      'send',
      'auth.password-reset',
      '--data',
      '{"userName":"Jane"}',
      '--yes',
    ])
    expect(result.code).toBe(2)
    expect(result.stderr + result.stdout).toContain('--to <email>')
  })

  it('refuses a non-object --data (exit 2)', async () => {
    const result = await cli([
      'send',
      'auth.password-reset',
      '--data',
      '["jane@example.com"]',
      '--yes',
    ])
    expect(result.code).toBe(2)
  })

  it('reports TRIGGER_KEY_NOT_FOUND as an API error (exit 1)', async () => {
    server.use(
      http.post(`${API}/v1/automations/triggers/by-key/nope/fire`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'TRIGGER_KEY_NOT_FOUND',
              message: 'No trigger has the key "nope" in this brand.',
              type: 'not_found_error',
              suggestion: 'List keys with GET /v1/app-emails.',
              docs: 'https://docs.brew.new',
              retryable: false,
            },
          },
          { status: 404 }
        )
      )
    )
    const result = await cli([
      'send',
      'nope',
      '--to',
      'jane@example.com',
      '--yes',
    ])
    expect(result.code).toBe(1)
    expect(result.stdout + result.stderr).toContain('TRIGGER_KEY_NOT_FOUND')
  })
})

describe('app-emails list / get', () => {
  it('lists with page flags', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/app-emails`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          data: [ROW],
          pagination: { limit: 5, cursor: null, hasMore: false },
        })
      })
    )
    const result = await cli(['app-emails', 'list', '--limit', '5'])
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('limit')).toBe('5')
    expect((result.json as { data: AppEmailRow[] }).data).toEqual([ROW])
  })

  it('follows the cursor with --all', async () => {
    const seen: Array<string | null> = []
    server.use(
      http.get(`${API}/v1/app-emails`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        seen.push(cursor)
        return HttpResponse.json(
          cursor === null
            ? {
                data: [ROW],
                pagination: { limit: 100, cursor: 'c2', hasMore: true },
              }
            : {
                data: [{ ...ROW, triggerKey: 'lifecycle.welcome' }],
                pagination: { limit: 100, cursor: null, hasMore: false },
              }
        )
      })
    )
    const result = await cli(['app-emails', 'list', '--all'])
    expect(result.code).toBe(0)
    expect(seen).toEqual([null, 'c2'])
    expect(
      (result.json as { data: AppEmailRow[] }).data.map((row) => row.triggerKey)
    ).toEqual(['auth.password-reset', 'lifecycle.welcome'])
  })

  it('renders readiness in the human table', async () => {
    server.use(
      http.get(`${API}/v1/app-emails`, () =>
        HttpResponse.json({
          data: [
            ROW,
            {
              ...ROW,
              triggerKey: 'order.paid',
              title: 'Order paid',
              published: false,
              sender: { mode: 'none' },
              readiness: {
                ready: false,
                teamOnly: false,
                blockers: ['AUTOMATION_NOT_PUBLISHED'],
              },
            },
          ],
          pagination: { limit: 100, cursor: null, hasMore: false },
        })
      )
    )
    const result = await cli(['app-emails', 'list'], { ttyOut: true })
    expect(result.stdout).toContain('auth.password-reset')
    expect(result.stdout).toContain('team only')
    expect(result.stdout).toContain('AUTOMATION_NOT_PUBLISHED')
  })

  it('gets one by key', async () => {
    server.use(
      http.get(`${API}/v1/app-emails/auth.password-reset`, () =>
        HttpResponse.json(ROW)
      )
    )
    const result = await cli(['app-emails', 'get', 'auth.password-reset'])
    expect(result.code).toBe(0)
    expect(result.json).toEqual(ROW)
  })
})

describe('app-emails upsert', () => {
  it('exits 4 when unconfirmed (it publishes)', async () => {
    const result = await cli(['app-emails', 'upsert', 'auth.password-reset'])
    expect(result.code).toBe(4)
    expect((result.json as { summary: string }).summary).toContain('publish it')
  })

  it('PUTs the starter setup with flags, without an Idempotency-Key', async () => {
    let body: unknown
    let idempotency: string | null = 'unset'
    server.use(
      http.put(
        `${API}/v1/app-emails/auth.password-reset`,
        async ({ request }) => {
          body = await request.json()
          idempotency = request.headers.get('idempotency-key')
          return HttpResponse.json(SETUP, { status: 201 })
        }
      )
    )
    const result = await cli([
      'app-emails',
      'upsert',
      'auth.password-reset',
      '--subject',
      'Reset your password',
      '--domain',
      'dom_1',
      '--overwrite',
      '--yes',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({
      subject: 'Reset your password',
      domainId: 'dom_1',
      overwrite: true,
    })
    expect(idempotency).toBeNull()
    expect(result.json).toEqual(SETUP)
  })

  it('reads a source file and infers jsx from .tsx', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'brew-upsert-'))
    const file = join(dir, 'order-paid.tsx')
    writeFileSync(file, 'export default function E() { return <p>Hi</p> }')
    let body: unknown
    server.use(
      http.put(`${API}/v1/app-emails/order.paid`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          { ...SETUP, triggerKey: 'order.paid' },
          { status: 201 }
        )
      })
    )
    const result = await cli([
      'app-emails',
      'upsert',
      'order.paid',
      '--source-file',
      file,
      '--yes',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({
      source: {
        format: 'jsx',
        content: readFileSync(file, 'utf8'),
      },
    })
  })

  it('skips the gate with --no-publish and sends publish: false', async () => {
    let body: unknown
    server.use(
      http.put(`${API}/v1/app-emails/order.paid`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ...SETUP, published: false })
      })
    )
    const result = await cli([
      'app-emails',
      'upsert',
      'order.paid',
      '--starter',
      'lifecycle.welcome',
      '--no-publish',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({ starter: 'lifecycle.welcome', publish: false })
  })

  it('refuses --starter with --source-file (exit 2)', async () => {
    const result = await cli(
      [
        'app-emails',
        'upsert',
        'order.paid',
        '--starter',
        'lifecycle.welcome',
        '--source-file',
        '-',
        '--format',
        'html',
        '--yes',
      ],
      { stdin: '<p>Hi</p>' }
    )
    expect(result.code).toBe(2)
  })

  it('surfaces APP_EMAIL_EDITED_IN_BREW (exit 1)', async () => {
    server.use(
      http.put(`${API}/v1/app-emails/lifecycle.welcome`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'APP_EMAIL_EDITED_IN_BREW',
              message: 'The design was edited in Brew since setup.',
              type: 'conflict_error',
              suggestion: 'Pass overwrite: true to replace it.',
              docs: 'https://docs.brew.new',
              retryable: false,
            },
          },
          { status: 409 }
        )
      )
    )
    const result = await cli([
      'app-emails',
      'upsert',
      'lifecycle.welcome',
      '--yes',
    ])
    expect(result.code).toBe(1)
    expect(result.stdout + result.stderr).toContain('APP_EMAIL_EDITED_IN_BREW')
  })
})

describe('app-emails kit', () => {
  const STACK = {
    provider: 'better-auth' as const,
    authDelivery: 'code' as const,
    note: 'Wire the callbacks in your Better Auth config.',
    keys: ['auth.verify-email', 'auth.password-reset'],
    snippets: [
      { title: 'Better Auth callbacks', file: 'lib/auth.ts', code: '…' },
    ],
  }

  it('exits 4 when unconfirmed', async () => {
    const result = await cli(['app-emails', 'kit', '--stack', 'better-auth'])
    expect(result.code).toBe(4)
    expect((result.json as { summary: string }).summary).toContain(
      'auth + lifecycle kit for better-auth'
    )
  })

  it('POSTs the kit body with an idempotency key', async () => {
    let body: unknown
    let idempotency: string | null = null
    server.use(
      http.post(`${API}/v1/app-emails/kit`, async ({ request }) => {
        body = await request.json()
        idempotency = request.headers.get('idempotency-key')
        return HttpResponse.json({
          results: [{ ...SETUP, ok: true }],
          stack: STACK,
        })
      })
    )
    const result = await cli([
      'app-emails',
      'kit',
      '--sets',
      'auth, lifecycle',
      '--stack',
      'better-auth',
      '--domain',
      'dom_1',
      '--idempotency-key',
      'kit:1',
      '--yes',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({
      sets: ['auth', 'lifecycle'],
      stack: 'better-auth',
      domainId: 'dom_1',
    })
    expect(idempotency).toBe('kit:1')
  })

  it('exits 1 with the full results when a key failed', async () => {
    server.use(
      http.post(`${API}/v1/app-emails/kit`, () =>
        HttpResponse.json({
          results: [
            { ...SETUP, ok: true },
            {
              triggerKey: 'auth.verify-email',
              ok: false,
              error: { code: 'INTERNAL_ERROR', message: 'Import failed.' },
            },
          ],
          stack: STACK,
        })
      )
    )
    const result = await cli([
      'app-emails',
      'kit',
      '--keys',
      'auth.password-reset,auth.verify-email',
      '--yes',
    ])
    expect(result.code).toBe(1)
    const data = result.json as { results: Array<{ ok: boolean }> }
    expect(data.results.map((entry) => entry.ok)).toEqual([true, false])
  })
})

describe('automations triggers --key', () => {
  it('create sends the key', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/automations/triggers`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          {
            triggerEventId: 'tri_1',
            key: 'order.paid',
            title: 'Order paid',
            provider: 'brew_api',
            payloadSchema: { type: 'object', fields: [] },
            createdAt: '2026-10-13T10:00:00.000Z',
            updatedAt: '2026-10-13T10:00:00.000Z',
          },
          { status: 201 }
        )
      })
    )
    const result = await cli([
      'automations',
      'triggers',
      'create',
      '--title',
      'Order paid',
      '--key',
      'order.paid',
      '--input',
      '{"payloadSchema":{"type":"object","fields":[{"key":"email","type":"string","required":true}]}}',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({
      title: 'Order paid',
      key: 'order.paid',
      payloadSchema: {
        type: 'object',
        fields: [{ key: 'email', type: 'string', required: true }],
      },
    })
  })

  it('update sends the key', async () => {
    let body: unknown
    server.use(
      http.patch(
        `${API}/v1/automations/triggers/tri_1`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({})
        }
      )
    )
    const result = await cli([
      'automations',
      'triggers',
      'update',
      'tri_1',
      '--key',
      'user.signup',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({ key: 'user.signup' })
  })

  it('list shows the KEY column', async () => {
    server.use(
      http.get(`${API}/v1/automations/triggers`, () =>
        HttpResponse.json({
          data: [
            {
              triggerEventId: 'tri_1',
              key: 'order.paid',
              title: 'Order paid',
              provider: 'brew_api',
              payloadSchema: { type: 'object', fields: [] },
              createdAt: '2026-10-13T10:00:00.000Z',
              updatedAt: '2026-10-13T10:00:00.000Z',
            },
          ],
          pagination: { limit: 100, cursor: null, hasMore: false },
        })
      )
    )
    const result = await cli(['automations', 'triggers', 'list'], {
      ttyOut: true,
    })
    expect(result.stdout.split('\n')[0]).toMatch(/TRIGGER\s+KEY\s+TITLE/)
    expect(result.stdout).toContain('order.paid')
  })
})

describe('local input checks (exit 2 before any request)', () => {
  it.each([
    [['send', 'Order Paid', '--to', 'jane@example.com', '--yes']],
    [['send', '.', '--to', 'jane@example.com', '--yes']],
    [['app-emails', 'get', 'auth/password-reset']],
    [['app-emails', 'upsert', 'Order.Paid', '--yes']],
    [['app-emails', 'upsert', 'order.paid', '--format', 'pdf', '--yes']],
    [['app-emails', 'kit', '--keys', '', '--yes']],
    [['app-emails', 'kit', '--sets', ',', '--yes']],
    [['app-emails', 'kit', '--sets', 'billing', '--yes']],
    [['app-emails', 'kit', '--stack', 'auth0', '--yes']],
    [['app-emails', 'kit', '--keys', 'order.paid', '--yes']],
    [['app-emails', 'kit', '--keys', 'auth.otp', '--sets', 'auth', '--yes']],
    [
      [
        'automations',
        'triggers',
        'create',
        '--title',
        'Paid',
        '--key',
        'Order',
      ],
    ],
  ])('%j', async (argv) => {
    // MSW fails any request: nothing reaches the API.
    const result = await cli(argv)
    expect(result.code).toBe(2)
  })

  it('upsert with the body on stdin always confirms (it may overwrite)', async () => {
    const result = await cli(
      ['app-emails', 'upsert', 'order.paid', '--no-publish', '--input', '-'],
      { stdin: '{"overwrite":true,"starter":"lifecycle.welcome"}' }
    )
    expect(result.code).toBe(4)
    expect((result.json as { summary: string }).summary).toContain('stdin')
  })

  it('kit summary names keys passed inline through --input', async () => {
    const result = await cli([
      'app-emails',
      'kit',
      '--input',
      '{"keys":["auth.otp"],"overwrite":true}',
    ])
    expect(result.code).toBe(4)
    expect((result.json as { summary: string }).summary).toContain(
      'Set up and publish auth.otp, replacing designs edited in Brew'
    )
  })

  it('the local vocabularies match the vendored spec', async () => {
    const { parse } = await import('yaml')
    const spec = parse(
      readFileSync(
        join(import.meta.dirname, '../../openapi/public-api-v1.yaml'),
        'utf8'
      )
    ) as {
      paths: Record<string, Record<string, Record<string, unknown>>>
      components: { schemas: Record<string, Record<string, unknown>> }
    }
    const resolve = (schema: Record<string, unknown>) =>
      typeof schema.$ref === 'string'
        ? (spec.components.schemas[schema.$ref.split('/').pop() ?? ''] ?? {})
        : schema
    type Body = {
      properties: Record<
        string,
        {
          enum?: string[]
          items?: { enum?: string[] }
          properties?: Record<string, { enum?: string[] }>
        }
      >
    }
    const body = (path: string, method: string): Body => {
      const operation = spec.paths[path]?.[method] as
        | {
            requestBody: {
              content: {
                'application/json': { schema: Record<string, unknown> }
              }
            }
          }
        | undefined
      if (operation === undefined) {
        throw new Error(`${method} ${path} is not in the vendored spec`)
      }
      return resolve(
        operation.requestBody.content['application/json'].schema
      ) as Body
    }
    const kit = body('/v1/app-emails/kit', 'post')
    const upsert = body('/v1/app-emails/{triggerKey}', 'put')
    const inputs = await import('../../src/lib/app-email-inputs')
    expect(kit.properties.sets?.items?.enum).toEqual([
      ...inputs.APP_EMAIL_KIT_SETS,
    ])
    expect(kit.properties.stack?.enum).toEqual([
      ...inputs.APP_EMAIL_AUTH_STACKS,
    ])
    expect(kit.properties.keys?.items?.enum).toEqual([
      ...inputs.APP_EMAIL_KIT_KEYS,
    ])
    expect(upsert.properties.source?.properties?.format?.enum).toEqual([
      ...inputs.APP_EMAIL_SOURCE_FORMATS,
    ])
  })
})
