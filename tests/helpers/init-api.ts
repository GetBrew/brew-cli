import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { expect } from 'vitest'
import type { InitReport } from '../../src/lib/init/report'
import type { SpawnFn } from '../../src/lib/types'
import { contractHandler } from './contract-artifacts'
import { loadSchema, validateSchema } from './json-schema'
import { APP_KEY, BRAND, CLI_KEY } from './login-server'
import { server } from './msw-server'
import { type RunCliOptions, type RunCliResult, runCli } from './run-cli'

/**
 * Brew's v1 API as `init` uses it, plus the run helpers its suites share
 * (`tests/commands/init*.test.ts`): a recording MSW handler set, a spawn
 * that installs nothing, a throwaway config dir, and an `init` runner that
 * checks the secret canary on every run.
 */

export const API = 'https://brew.new/api'
export const EXPLICIT_KEY = 'brew_explicit0123456789abcdefghijklmno'
export const SECRETS = [APP_KEY, CLI_KEY, EXPLICIT_KEY]
export const REPORT_SCHEMA = loadSchema('init-report.json')

export const KIT_KEYS = [
  'auth.verify-email',
  'auth.password-reset',
  'auth.magic-link',
  'lifecycle.welcome',
]

export type Recorded = {
  readonly method: string
  readonly path: string
  readonly body: unknown
  readonly idempotencyKey: string | null
  readonly brandId: string | null
  readonly authorization: string | null
}

export function titleOf(key: string): string {
  return key
    .split(/[.-]/)
    .slice(1)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** The kit's trigger rows, as `GET /v1/automations/triggers` lists them. */
export function kitTriggerRows() {
  return KIT_KEYS.map((key, index) => ({
    triggerEventId: `tri_${index}`,
    key,
    title: titleOf(key),
    provider: 'brew_api',
    payloadSchema: {
      type: 'object',
      fields: [
        { key: 'email', type: 'string', required: true },
        { key: 'appName', type: 'string', required: false },
        { key: 'userName', type: 'string', required: false },
        ...(key.startsWith('auth.')
          ? [
              { key: 'confirmationUrl', type: 'string', required: false },
              { key: 'otp', type: 'string', required: false },
            ]
          : []),
      ],
    },
    createdAt: '2026-10-13T12:00:00.000Z',
    updatedAt: '2026-10-13T12:00:00.000Z',
  }))
}

/** Brew's v1 API for init: brand, domains, kit, triggers, the by-key fire. */
export function useBrewApi(
  options: {
    readonly domains?: ReadonlyArray<Record<string, unknown>>
    readonly failKeys?: readonly string[]
    /** A kit key's refusal, by key (beats `failKeys`' INTERNAL_ERROR). */
    readonly refusals?: Readonly<
      Record<string, { readonly code: string; readonly message: string }>
    >
    /** `warnings` on the `POST /v1/domains` row. */
    readonly addWarnings?: ReadonlyArray<Record<string, unknown>>
    /** `GET /v1/brand`'s website (default acme.com). */
    readonly brandDomain?: string
    /** `GET /v1/brand` answers 400 BRAND_ID_REQUIRED (an organization key). */
    readonly orgKeyWithoutBrand?: boolean
    /** `GET /v1/brands` rows (default: the signed-in brand only). */
    readonly brands?: ReadonlyArray<Record<string, unknown>>
    /** `POST /v1/brands` answers this status (default 201). */
    readonly createBrandStatus?: number
    /** Per provider: the connection `GET …/connection` returns (absent: 404). */
    readonly connections?: Partial<
      Record<'supabase_auth' | 'clerk', Record<string, unknown>>
    >
    /** `GET /v1/app-emails` rows (default: every kit key, published). */
    readonly appEmails?: ReadonlyArray<Record<string, unknown>>
  } = {}
): Recorded[] {
  const requests: Recorded[] = []
  const record = async (request: Request): Promise<unknown> => {
    const text = await request.text()
    const body = text === '' ? undefined : (JSON.parse(text) as unknown)
    requests.push({
      method: request.method,
      path: new URL(request.url).pathname.replace(/^\/api/, ''),
      body,
      idempotencyKey: request.headers.get('idempotency-key'),
      brandId: request.headers.get('x-brand-id'),
      authorization: request.headers.get('authorization'),
    })
    return body
  }
  server.use(
    contractHandler(API, kitTriggerRows),
    http.get(`${API}/v1/brand`, async ({ request }) => {
      await record(request)
      if (
        options.orgKeyWithoutBrand === true &&
        request.headers.get('x-brand-id') === null
      ) {
        return HttpResponse.json(
          {
            error: {
              code: 'BRAND_ID_REQUIRED',
              type: 'invalid_request_error',
              message: 'Organization keys must send X-Brand-Id.',
            },
          },
          { status: 400 }
        )
      }
      return HttpResponse.json({
        brandId: request.headers.get('x-brand-id') ?? BRAND.brandId,
        domain: options.brandDomain ?? 'acme.com',
        status: 'completed',
        ready: true,
        identity: { brandName: BRAND.name },
      })
    }),
    http.get(`${API}/v1/domains`, async ({ request }) => {
      await record(request)
      return HttpResponse.json({
        data: options.domains ?? [],
        pagination: { limit: 100, cursor: null, hasMore: false },
      })
    }),
    http.post(`${API}/v1/domains`, async ({ request }) => {
      const body = (await record(request)) as { name: string }
      return HttpResponse.json(
        {
          domainId: 'dom_new',
          domainUrl: 'https://brew.new/domains/dom_new',
          name: body.name,
          region: 'us-east-1',
          status: 'not_started',
          sendingEnabled: false,
          sendable: false,
          sendingPurpose: 'transactional',
          records: [
            {
              record: 'DKIM',
              name: `brew._domainkey.${body.name}`,
              type: 'TXT',
              ttl: 'Auto',
              status: 'not_started',
              value: 'p=MIGf…',
            },
          ],
          createdAt: '2026-10-13T12:00:00.000Z',
          updatedAt: '2026-10-13T12:00:00.000Z',
          ...(options.addWarnings === undefined
            ? {}
            : { warnings: options.addWarnings }),
        },
        { status: 201 }
      )
    }),
    http.get(
      `${API}/v1/integrations/:provider/connection`,
      async ({ request, params }) => {
        await record(request)
        const connection =
          options.connections?.[
            String(params.provider) as 'supabase_auth' | 'clerk'
          ]
        if (connection === undefined) {
          return HttpResponse.json(
            {
              error: {
                code: 'NOT_FOUND',
                type: 'not_found_error',
                message: `${String(params.provider)} is not connected for this brand.`,
              },
            },
            { status: 404 }
          )
        }
        return HttpResponse.json(connection)
      }
    ),
    http.put(
      `${API}/v1/integrations/:provider/connection`,
      async ({ request, params }) => {
        await record(request)
        const provider = String(params.provider)
        return HttpResponse.json({
          provider,
          connectionId: `conn_${provider}`,
          webhookUrl: webhookUrlFor(provider),
          status: 'pending_verification',
          authEmails: KIT_KEYS.filter((key) => key.startsWith('auth.')).map(
            (triggerKey) => ({ triggerKey, ok: true })
          ),
        })
      }
    ),
    http.get(`${API}/v1/app-emails`, async ({ request }) => {
      await record(request)
      return HttpResponse.json({
        data:
          options.appEmails ??
          KIT_KEYS.map((key, index) => ({
            triggerKey: key,
            triggerEventId: `tri_${index}`,
            title: titleOf(key),
            emailId: `eml_${index}`,
            automationId: `aut_${index}`,
            published: true,
          })),
        pagination: { limit: 100, cursor: null, hasMore: false },
      })
    }),
    http.get(`${API}/v1/brands`, async ({ request }) => {
      await record(request)
      return HttpResponse.json({
        data: options.brands ?? [
          {
            brandId: BRAND.brandId,
            domain: options.brandDomain ?? 'acme.com',
            status: 'completed',
            ready: true,
          },
        ],
        pagination: { limit: 100, cursor: null, hasMore: false },
      })
    }),
    http.post(`${API}/v1/brands`, async ({ request }) => {
      const body = (await record(request)) as { url: string }
      const status = options.createBrandStatus ?? 201
      if (status !== 201) {
        return HttpResponse.json(
          {
            error: {
              code: status === 403 ? 'ORG_SCOPE_REQUIRED' : 'INTERNAL_ERROR',
              type: status === 403 ? 'permission_error' : 'internal_error',
              message:
                status === 403
                  ? 'Creating a brand needs an organization-scoped key.'
                  : 'Failed.',
            },
          },
          { status }
        )
      }
      return HttpResponse.json(
        {
          brandId: 'brand_new',
          domain: new URL(body.url).hostname,
          status: 'extracting',
          ready: false,
          progress: 0,
          extraction: { chatId: 'chat_1', statusUrl: '/v1/brands/brand_new' },
        },
        { status: 201 }
      )
    }),
    http.get(`${API}/v1/brands/:brandId`, async ({ request, params }) => {
      await record(request)
      return HttpResponse.json({
        brandId: String(params.brandId),
        domain: 'app.example.dev',
        status: 'completed',
        ready: true,
        progress: 100,
      })
    }),
    http.post(`${API}/v1/app-emails/kit`, async ({ request }) => {
      await record(request)
      return HttpResponse.json({
        results: KIT_KEYS.map((key, index) =>
          options.refusals?.[key] !== undefined
            ? { triggerKey: key, ok: false, error: options.refusals[key] }
            : options.failKeys?.includes(key)
              ? {
                  triggerKey: key,
                  ok: false,
                  error: { code: 'INTERNAL_ERROR', message: 'Import failed.' },
                }
              : {
                  ok: true,
                  triggerKey: key,
                  triggerEventId: `tri_${index}`,
                  emailId: `eml_${index}`,
                  emailVersionId: `emv_${index}`,
                  automationId: `aut_${index}`,
                  published: true,
                  created: { trigger: true, email: true, automation: true },
                  sender: {
                    mode: 'sandbox',
                    from: 'acme@email.brew.new',
                    sandbox: { dailyLimit: 50, remainingToday: 50 },
                  },
                  payloadSchema: { type: 'object', fields: [] },
                  fireExample: {
                    method: 'POST',
                    path: `/v1/automations/triggers/by-key/${key}/fire`,
                    examplePayload: { email: 'jane@example.com' },
                    curl: 'curl …',
                    sdk: `await brew.send('${key}', { email })`,
                  },
                  warnings: [],
                }
        ),
        stack: {
          provider: 'better-auth',
          authDelivery: 'code',
          note: 'Wire the callbacks into betterAuth.',
          keys: KIT_KEYS.filter((key) => key.startsWith('auth.')),
          snippets: [],
        },
      })
    }),
    http.get(`${API}/v1/automations/triggers`, async ({ request }) => {
      await record(request)
      return HttpResponse.json({
        data: kitTriggerRows(),
        pagination: { limit: 100, cursor: null, hasMore: false },
      })
    }),
    http.post(
      `${API}/v1/automations/triggers/by-key/:key/fire`,
      async ({ request, params }) => {
        await record(request)
        return HttpResponse.json(
          {
            triggerInstanceId: 'tin_1',
            triggerEventId: 'tri_3',
            triggerKey: String(params.key),
            status: 'triggered',
            automationRunIds: ['run_1'],
            notStarted: [],
            publishedAutomations: [{ automationId: 'aut_3' }],
            counts: { automations: 1, skipped: 0 },
            warnings: [],
            receivedAt: '2026-10-13T12:00:00.000Z',
          },
          { status: 202 }
        )
      }
    )
  )
  return requests
}

export type SpawnCall = {
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string | undefined
}

/** git is "not a repository" (the .gitignore fallback); installs succeed. */
export function recordingSpawn(): {
  readonly calls: SpawnCall[]
  readonly spawn: SpawnFn
} {
  const calls: SpawnCall[] = []
  return {
    calls,
    spawn: async (command, args, options) => {
      if (command === 'git') {
        return { code: 128, stdout: '', stderr: 'fatal: not a git repository' }
      }
      calls.push({ command, args, cwd: options?.cwd })
      return { code: 0, stdout: '', stderr: '' }
    },
  }
}

export function configEnv(
  extra: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-init-')),
    ...extra,
  }
}

export async function init(
  argv: readonly string[],
  options: RunCliOptions & { readonly cwd: string }
): Promise<RunCliResult & { readonly report: InitReport }> {
  const result = await runCli(['init', ...argv], options)
  // Secret canary: no key ever reaches the terminal, in any mode.
  for (const secret of SECRETS) {
    expect(result.stdout).not.toContain(secret)
    expect(result.stderr).not.toContain(secret)
  }
  return { ...result, report: result.json as InitReport }
}

export function expectValidReport(report: InitReport): void {
  expect(validateSchema(REPORT_SCHEMA, report)).toEqual([])
}

export function read(root: string, path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

export const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** The hosted hook URL the mocked connect returns. */
export function webhookUrlFor(provider: string): string {
  return `https://brew.new/api/integrations/${provider}/webhook/conn_${provider}`
}
