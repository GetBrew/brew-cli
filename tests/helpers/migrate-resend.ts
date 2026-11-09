import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { expect } from 'vitest'
import type { MigrationManifest } from '../../src/lib/migrate/manifest'
import type { MigrationReport } from '../../src/lib/migrate/report'
import { copyFixture } from './fixtures'
import { server } from './msw-server'
import { type RunCliOptions, runCli } from './run-cli'

/** Brew's v1 API as `migrate resend` uses it, and the run helpers its tests share. */

const API = 'https://brew.new/api'
export const BREW_KEY = 'brew_migrate0123456789abcdefghijklmn'
export const RESEND_KEY = 're_CANARY_resend_secret_0123456789'

/** Everything that must never reach stdout, stderr or brew.migration.json. */
export const SECRETS = [RESEND_KEY, BREW_KEY, 'WEBHOOKTOKEN123']
const PII = [
  'ada@example.com',
  'bob@example.com',
  'carol@example.com',
  'bounced@example.com',
  'Lovelace',
  // Literal recipients in the fixture's code.
  'a@example.com',
  'b@example.com',
  'c@example.com',
]

type BrewCall = {
  readonly method: string
  readonly path: string
  readonly body: unknown
  readonly idempotencyKey: string | null
  readonly authorization: string | null
}

export const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Brew's v1 API as the migration uses it; every call recorded. */
export function useBrewApi(
  options: {
    readonly brandId?: string
    readonly domains?: ReadonlyArray<Record<string, unknown>>
    /** App emails Brew already has, by key; `unreadable` fails the list. */
    readonly appEmailKeys?: readonly string[] | 'unreadable'
    readonly audiences?: ReadonlyArray<Record<string, unknown>>
    /** Refuse the contacts upserts holding this address until healed. */
    readonly failContact?: string
    /** Refuse this address's row (and land the rest) until healed. */
    readonly refuseRow?: string
    /** Refuse the app email setup of these keys with this API error. */
    readonly refuseKeys?: Readonly<
      Record<string, { readonly status: number; readonly error: object }>
    >
  } = {}
) {
  const calls: BrewCall[] = []
  let imported = 0
  let healed = false
  const record = async (request: Request): Promise<unknown> => {
    const text = await request.text()
    const body = text === '' ? undefined : (JSON.parse(text) as unknown)
    calls.push({
      method: request.method,
      path: new URL(request.url).pathname.replace(/^\/api/, ''),
      body,
      idempotencyKey: request.headers.get('idempotency-key'),
      authorization: request.headers.get('authorization'),
    })
    return body
  }
  server.use(
    http.get(`${API}/v1/brand`, async ({ request }) => {
      await record(request)
      return HttpResponse.json({
        brandId: options.brandId ?? 'bd_acme',
        domain: 'acme.com',
        status: 'completed',
        ready: true,
        identity: { brandName: 'Acme' },
      })
    }),
    http.get(`${API}/v1/domains`, async ({ request }) => {
      await record(request)
      return HttpResponse.json({
        data: options.domains ?? [
          {
            domainId: 'dom_news',
            name: 'news.acme.dev',
            status: 'verified',
            sendingPurpose: 'marketing',
          },
        ],
        pagination: { limit: 100, cursor: null, hasMore: false },
      })
    }),
    http.get(`${API}/v1/app-emails`, async ({ request }) => {
      await record(request)
      if (options.appEmailKeys === 'unreadable') {
        return HttpResponse.json(
          {
            error: {
              code: 'INTERNAL_ERROR',
              type: 'internal',
              message: 'Try again.',
            },
          },
          { status: 500 }
        )
      }
      return HttpResponse.json({
        data: (options.appEmailKeys ?? []).map((triggerKey) => ({
          triggerKey,
        })),
        pagination: { limit: 100, cursor: null, hasMore: false },
      })
    }),
    http.post(`${API}/v1/emails/import`, async ({ request }) => {
      const body = (await record(request)) as { title?: string }
      imported += 1
      return HttpResponse.json(
        {
          emailId: `eml_${imported}`,
          emailVersionId: `emv_${imported}`,
          html: `<p>converted ${body.title ?? ''} {{ trigger.RESET_URL }}</p>`,
          assetReport: { warnings: [{ code: 'escaping_changed' }] },
          variables: [{ path: 'trigger.RESET_URL' }],
          group: null,
          subjectLine: 'Subject',
        },
        { status: 201 }
      )
    }),
    http.put(`${API}/v1/app-emails/:key`, async ({ request, params }) => {
      const body = (await record(request)) as { publish?: boolean }
      const key = String(params.key)
      const refusal = options.refuseKeys?.[key]
      if (refusal !== undefined) {
        return HttpResponse.json(
          { error: refusal.error },
          { status: refusal.status }
        )
      }
      return HttpResponse.json({
        triggerKey: key,
        triggerEventId: `tri_${key}`,
        emailId: `eml_app_${key}`,
        emailVersionId: 'emv_app',
        automationId: `aut_${key}`,
        published: body.publish !== false,
        created: { trigger: true, email: true, automation: true },
        sender: { mode: 'sandbox', from: 'acme@email.brew.new' },
        payloadSchema: { type: 'object', fields: [] },
        fireExample: {
          method: 'POST',
          path: `/v1/automations/triggers/by-key/${key}/fire`,
          examplePayload: { email: 'jane@example.com' },
          curl: 'curl …',
          sdk: `await brew.send('${key}', { email })`,
        },
        warnings: [],
      })
    }),
    http.delete(`${API}/v1/emails/:emailId`, async ({ request }) => {
      await record(request)
      return HttpResponse.json({ deleted: true })
    }),
    http.post(`${API}/v1/contacts`, async ({ request }) => {
      const body = (await record(request)) as {
        contacts: Array<{ email: string }>
      }
      if (
        options.failContact !== undefined &&
        !healed &&
        body.contacts.some((row) => row.email === options.failContact)
      ) {
        return HttpResponse.json(
          {
            error: {
              code: 'INVALID_PAYLOAD',
              type: 'invalid_request',
              message: 'Upsert refused.',
            },
          },
          { status: 422 }
        )
      }
      const refused = healed
        ? []
        : body.contacts.flatMap((row, index) =>
            row.email === options.refuseRow
              ? [
                  {
                    email: row.email,
                    row: index + 1,
                    code: 'FIELD_TYPE_MISMATCH',
                    field: 'customFields.plan',
                    message: 'plan is a number in Brew.',
                  },
                ]
              : []
          )
      return HttpResponse.json({
        summary: {
          inserted: body.contacts.length - refused.length,
          updated: 0,
          failed: refused.length,
        },
        fieldsCreated: [],
        errors: refused,
        warnings: [],
      })
    }),
    http.get(`${API}/v1/audiences`, async ({ request }) => {
      await record(request)
      return HttpResponse.json({
        data: options.audiences ?? [],
        pagination: { limit: 100, cursor: null, hasMore: false },
      })
    }),
    http.post(`${API}/v1/audiences`, async ({ request }) => {
      const body = (await record(request)) as { name: string }
      return HttpResponse.json(
        { audienceId: `aud_${body.name.length}`, audienceName: body.name },
        { status: 201 }
      )
    }),
    http.post(
      `${API}/v1/domains/:domainId/unsubscribes/import`,
      async ({ request }) => {
        const body = (await record(request)) as { csv: string }
        const rows = body.csv.split('\n').length - 1
        return HttpResponse.json({
          summary: {
            added: rows,
            created: 0,
            alreadyUnsubscribed: 0,
            skipped: 0,
          },
        })
      }
    )
  )
  return {
    calls,
    heal: () => {
      healed = true
    },
  }
}

export function env(
  extra: Readonly<Record<string, string | undefined>> = {}
): Readonly<Record<string, string | undefined>> {
  return {
    BREW_CLI_CONFIG_DIR: join(copyFixture('no-package-json'), '.config'),
    BREW_API_KEY: BREW_KEY,
    RESEND_API_KEY: RESEND_KEY,
    ...extra,
  }
}

export async function migrate(
  argv: readonly string[],
  options: RunCliOptions & { readonly cwd: string }
) {
  const result = await runCli(['migrate', 'resend', ...argv], options)
  // Secret canary: neither key (nor a webhook token) ever reaches the terminal.
  for (const secret of SECRETS) {
    expect(result.stdout).not.toContain(secret)
    expect(result.stderr).not.toContain(secret)
  }
  return { ...result, report: result.json as MigrationReport }
}

export function readManifest(root: string): MigrationManifest {
  const text = readFileSync(join(root, 'brew.migration.json'), 'utf8')
  // The manifest is safe to commit: no key, token, address or name.
  for (const value of [...SECRETS, ...PII]) {
    expect(text).not.toContain(value)
  }
  return JSON.parse(text) as MigrationManifest
}

export function phase(report: MigrationReport, id: string) {
  return report.phases.find((entry) => entry.id === id)
}
