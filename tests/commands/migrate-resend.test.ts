import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import type { MigrationManifest } from '../../src/lib/migrate/manifest'
import type { MigrationReport } from '../../src/lib/migrate/report'
import { copyFixture } from '../helpers/fixtures'
import { fakeClock } from '../helpers/login-server'
import { server } from '../helpers/msw-server'
import {
  RESEND_ACCOUNT,
  type ResendAccount,
  useResendApi,
} from '../helpers/resend-api'
import { type RunCliOptions, runCli } from '../helpers/run-cli'

const API = 'https://brew.new/api'
const BREW_KEY = 'brew_migrate0123456789abcdefghijklmn'
const RESEND_KEY = 're_CANARY_resend_secret_0123456789'

/** Everything that must never reach stdout, stderr or brew.migration.json. */
const SECRETS = [RESEND_KEY, BREW_KEY, 'WEBHOOKTOKEN123']
const PII = [
  'ada@example.com',
  'bob@example.com',
  'carol@example.com',
  'bounced@example.com',
  'Lovelace',
]

type BrewCall = {
  readonly method: string
  readonly path: string
  readonly body: unknown
  readonly idempotencyKey: string | null
  readonly authorization: string | null
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Brew's v1 API as the migration uses it; every call recorded. */
function useBrewApi(
  options: {
    readonly domains?: ReadonlyArray<Record<string, unknown>>
    /** Refuse the contacts upserts holding this address until healed. */
    readonly failContact?: string
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
        brandId: 'bd_acme',
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
      return HttpResponse.json({
        data: [],
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
      return HttpResponse.json({
        summary: {
          inserted: body.contacts.length,
          updated: 0,
          failed: 0,
        },
        fieldsCreated: [],
        errors: [],
        warnings: [],
      })
    }),
    http.get(`${API}/v1/audiences`, async ({ request }) => {
      await record(request)
      return HttpResponse.json({
        data: [],
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

function env(
  extra: Readonly<Record<string, string | undefined>> = {}
): Readonly<Record<string, string | undefined>> {
  return {
    BREW_CLI_CONFIG_DIR: join(copyFixture('no-package-json'), '.config'),
    BREW_API_KEY: BREW_KEY,
    RESEND_API_KEY: RESEND_KEY,
    ...extra,
  }
}

async function migrate(
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

function readManifest(root: string): MigrationManifest {
  const text = readFileSync(join(root, 'brew.migration.json'), 'utf8')
  // The manifest is safe to commit: no key, token, address or name.
  for (const value of [...SECRETS, ...PII]) {
    expect(text).not.toContain(value)
  }
  return JSON.parse(text) as MigrationManifest
}

function phase(report: MigrationReport, id: string) {
  return report.phases.find((entry) => entry.id === id)
}

describe('migrate resend: the plan (default)', () => {
  it('reads Resend at 2 requests a second or slower, writes brew.migration.json, changes nothing', async () => {
    const root = copyFixture('migrate-resend')
    const clock = fakeClock()
    const resend = useResendApi({ key: RESEND_KEY, clock })
    server.use(resend.handler)
    const brew = useBrewApi({
      domains: [
        {
          domainId: 'dom_acme',
          name: 'acme.com',
          status: 'verified',
          sendingPurpose: 'transactional',
        },
      ],
    })
    const result = await migrate(['--json'], { cwd: root, env: env(), clock })
    expect(result.code).toBe(0)
    const { report } = result
    expect(report.status).toBe('planned')
    expect(report.mode).toBe('plan')
    expect(report.resend.keySource).toBe('env')

    // Nothing written to Brew; the Resend key never went there.
    expect(brew.calls.filter((call) => MUTATING.has(call.method))).toEqual([])
    for (const call of brew.calls) {
      expect(call.authorization).toBe(`Bearer ${BREW_KEY}`)
      expect(JSON.stringify(call.body ?? null)).not.toContain(RESEND_KEY)
    }
    // Every Resend request carried the Resend key, never Brew's.
    expect(resend.requests.length).toBeGreaterThan(5)
    for (const request of resend.requests) {
      expect(request.authorization).toBe(`Bearer ${RESEND_KEY}`)
    }
    // Paced: consecutive requests at least 500 ms apart (2 per second).
    for (let index = 1; index < resend.requests.length; index++) {
      const gap =
        (resend.requests[index]?.at ?? 0) -
        (resend.requests[index - 1]?.at ?? 0)
      expect(gap).toBeGreaterThanOrEqual(500)
    }
    // The plan reads no contact's topic choices (one request per contact).
    expect(
      resend.requests.some(
        (request) =>
          request.path.endsWith('/topics') &&
          request.path.startsWith('/contacts/')
      )
    ).toBe(false)

    // Templates become app emails by key; aliases first.
    const templates = phase(report, 'templates')
    expect(templates?.items.map((item) => [item.key, item.status])).toEqual([
      ['reset-password', 'planned'],
      ['receipt', 'planned'],
    ])
    // The Resend domain is also in Brew: one resend._domainkey for both.
    const domains = phase(report, 'domains')
    expect(domains?.items[0]?.warnings?.[0]?.code).toBe('DKIM_SELECTOR_IN_USE')
    expect(domains?.items[0]?.detail).toContain('mail.acme.com')

    // Contacts and suppressions are counted, never listed.
    expect(phase(report, 'contacts')?.counts).toEqual({
      subscribed: 1,
      unsubscribed: 1,
      noConsentState: 1,
    })
    expect(phase(report, 'suppressions')?.status).toBe('manual')
    expect(phase(report, 'segments')?.items[0]?.brew?.fieldName).toBe(
      'resend_segment_beta_users'
    )
    expect(phase(report, 'topics')?.items[0]?.brew?.fieldName).toBe(
      'resend_topic_product_updates'
    )
    expect(
      phase(report, 'broadcasts')?.items.map((item) => [item.name, item.status])
    ).toEqual([
      ['October news', 'planned'],
      ['Launch', 'skipped'],
    ])
    // Webhooks and automations are reported, never copied.
    expect(phase(report, 'webhooks')?.items[0]).toMatchObject({
      status: 'manual',
      name: 'https://hooks.acme.com',
    })
    expect(phase(report, 'automations')?.items[0]?.status).toBe('manual')

    // The code scan found every send (not the ones in a comment, a string
    // or a regular expression), and says which carry over.
    expect(report.callSites).toHaveLength(5)
    expect(
      report.callSites.map((site) => `${site.file}:${site.method}`)
    ).toEqual(
      expect.arrayContaining([
        'src/lib/notify.ts:emails.send',
        'src/app/api/signup/route.tsx:emails.send',
        'src/jobs/digest.cjs:batch.send',
        'src/jobs/digest.cjs:emails.send',
      ])
    )
    const digest = report.callSites.find(
      (site) =>
        site.file === 'src/jobs/digest.cjs' && site.method === 'emails.send'
    )
    expect(digest?.unsupported).toEqual(expect.arrayContaining(['cc']))
    const code = phase(report, 'code')
    expect(
      code?.items
        .filter((item) => item.kind === 'react-email')
        .map((item) => [item.file, item.status])
    ).toEqual(
      expect.arrayContaining([
        ['emails/welcome.tsx', 'planned'],
        ['emails/invoice.tsx', 'manual'],
      ])
    )

    // The manifest is written, and the next step applies it.
    const manifest = readManifest(root)
    expect(manifest.brandId).toBe('bd_acme')
    expect(manifest.phases.templates?.items).toHaveLength(2)
    expect(report.nextSteps[0]).toMatchObject({
      id: 'apply',
      blocking: true,
      command: 'brew-cli migrate resend --json --apply --yes',
    })
  })

  it('--dry-run writes no manifest', async () => {
    const root = copyFixture('migrate-resend')
    const clock = fakeClock()
    server.use(useResendApi({ key: RESEND_KEY, clock }).handler)
    useBrewApi()
    const result = await migrate(['--dry-run', '--json'], {
      cwd: root,
      env: env(),
      clock,
    })
    expect(result.code).toBe(0)
    expect(result.report.manifest.written).toBe(false)
    expect(existsSync(join(root, 'brew.migration.json'))).toBe(false)
  })

  it('--only code scans the project without a Resend key', async () => {
    const root = copyFixture('migrate-resend')
    useBrewApi()
    const result = await migrate(['--only', 'code', '--json'], {
      cwd: root,
      env: env({ RESEND_API_KEY: undefined }),
      clock: fakeClock(),
    })
    expect(result.code).toBe(0)
    expect(result.report.resend).toEqual({ keySource: 'none', requests: 0 })
    expect(result.report.callSites.length).toBeGreaterThan(0)
  })

  it('reading the account without a Resend key is a usage error (exit 2)', async () => {
    const root = copyFixture('migrate-resend')
    const result = await migrate(['--json'], {
      cwd: root,
      env: env({ RESEND_API_KEY: undefined }),
      clock: fakeClock(),
    })
    expect(result.code).toBe(2)
  })

  it('reads the Resend key from stdin with --resend-key-stdin', async () => {
    const root = copyFixture('migrate-resend')
    const clock = fakeClock()
    server.use(useResendApi({ key: RESEND_KEY, clock }).handler)
    useBrewApi()
    const result = await migrate(['--resend-key-stdin', '--json'], {
      cwd: root,
      env: env({ RESEND_API_KEY: undefined }),
      stdin: `${RESEND_KEY}\n`,
      clock,
    })
    expect(result.code).toBe(0)
    expect(result.report.resend.keySource).toBe('stdin')
  })

  it('a sending-only Resend key exits 3 with a full-access next step', async () => {
    const root = copyFixture('migrate-resend')
    const clock = fakeClock()
    server.use(
      useResendApi({
        key: RESEND_KEY,
        clock,
        reject: {
          status: 401,
          body: {
            statusCode: 401,
            name: 'restricted_api_key',
            message: 'This API key is restricted to only send emails',
          },
        },
      }).handler
    )
    useBrewApi()
    const result = await migrate(['--json'], { cwd: root, env: env(), clock })
    expect(result.code).toBe(3)
    expect(result.report.status).toBe('auth_required')
    expect(result.report.findings.map((finding) => finding.code)).toContain(
      'RESEND_KEY_SENDING_ONLY'
    )
    expect(
      result.report.nextSteps.find(
        (step) => step.id === 'resend-full-access-key'
      )
    ).toMatchObject({ actor: 'human', blocking: true })
  })
})

describe('migrate resend --apply', () => {
  it('exits 4 without --yes off a terminal', async () => {
    const root = copyFixture('migrate-resend')
    const result = await migrate(['--apply', '--json'], {
      cwd: root,
      env: env(),
      clock: fakeClock(),
    })
    expect(result.code).toBe(4)
  })

  it('copies templates, React Email, contacts, segments, topics, suppressions and broadcasts', async () => {
    const root = copyFixture('migrate-resend')
    const clock = fakeClock()
    server.use(useResendApi({ key: RESEND_KEY, clock }).handler)
    const brew = useBrewApi()
    const result = await migrate(
      ['--apply', '--yes', '--json', '--domain', 'news.acme.dev'],
      { cwd: root, env: env(), clock }
    )
    expect(result.code).toBe(0)
    const { report } = result
    // Call sites outside templates are left for the agent.
    expect(report.status).toBe('action_required')

    const writes = brew.calls.filter((call) => MUTATING.has(call.method))
    for (const call of writes) {
      // Every Brew write replays safely, and never carries the Resend key.
      expect(JSON.stringify(call.body ?? null)).not.toContain(RESEND_KEY)
      if (call.method === 'POST') {
        expect(call.idempotencyKey).toMatch(/^mig-/)
      }
    }

    // Resend templates: imported with the Resend placeholder mode, set up
    // by key from the converted HTML, the intermediate import deleted.
    const imports = writes.filter((call) => call.path === '/v1/emails/import')
    expect(imports[0]?.body).toMatchObject({
      format: 'html',
      title: 'Reset password',
      subjectLine: 'Reset your password',
      placeholders: 'resend',
      variables: [{ key: 'PRODUCT', fallbackValue: 'Acme' }],
    })
    const reset = writes.find(
      (call) => call.path === '/v1/app-emails/reset-password'
    )
    expect(reset?.body).toMatchObject({
      source: { format: 'html' },
      subject: 'Subject',
      from: { localPart: 'hello', name: 'Acme' },
      publish: true,
    })
    const receipt = writes.find(
      (call) => call.path === '/v1/app-emails/receipt'
    )
    // A draft in Resend stays unpublished in Brew.
    expect(receipt?.body).toMatchObject({
      publish: false,
      from: { localPart: 'billing', name: 'Acme Billing' },
    })
    // React Email: props become merge tags.
    expect(
      imports.find((call) => (call.body as { format: string }).format === 'jsx')
        ?.body
    ).toMatchObject({
      format: 'jsx',
      props: 'merge_tags',
      title: 'welcome',
    })
    expect(writes.some((call) => call.path === '/v1/app-emails/welcome')).toBe(
      true
    )
    const deletes = writes.filter((call) => call.method === 'DELETE')
    // Three app emails, each import deleted; the broadcast draft is kept.
    expect(deletes).toHaveLength(3)

    // Contacts: subscribed with an import consent record; unsubscribed stay
    // unsubscribed and join the domain's unsubscribe list; no state, left out.
    const upserts = writes.filter((call) => call.path === '/v1/contacts')
    const subscribed = upserts[0]?.body as {
      contacts: Array<Record<string, unknown>>
      consent?: { source: string }
    }
    expect(subscribed.contacts).toEqual([
      {
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        customFields: { plan: 'pro' },
      },
    ])
    expect(subscribed.consent?.source).toBe('import')
    expect(upserts[1]?.body).toEqual({
      contacts: [
        { email: 'bob@example.com', firstName: 'Bob', subscribed: false },
      ],
    })
    expect(JSON.stringify(upserts.map((call) => call.body))).not.toContain(
      'carol@example.com'
    )
    const optOuts = writes.filter(
      (call) => call.path === '/v1/domains/dom_news/unsubscribes/import'
    )
    expect(optOuts.map((call) => (call.body as { csv: string }).csv)).toEqual([
      'email\nbob@example.com',
      'email\nbounced@example.com',
    ])

    // Segments and topics: a boolean field each, and an audience on it.
    expect(
      upserts.some((call) =>
        JSON.stringify(call.body).includes('"resend_segment_beta_users":true')
      )
    ).toBe(true)
    const topics = upserts.find((call) =>
      JSON.stringify(call.body).includes('resend_topic_product_updates')
    )?.body as { contacts: Array<Record<string, unknown>> }
    expect(topics.contacts).toEqual([
      {
        email: 'ada@example.com',
        customFields: { resend_topic_product_updates: true },
      },
      {
        email: 'bob@example.com',
        customFields: { resend_topic_product_updates: false },
        subscribed: false,
      },
    ])
    const audiences = writes
      .filter((call) => call.path === '/v1/audiences')
      .map((call) => call.body)
    expect(audiences).toEqual([
      {
        name: 'Beta users',
        filters: {
          filters: [
            { field: 'resend_segment_beta_users', operator: 'is_true' },
          ],
          logicalOperator: 'and',
        },
      },
      {
        name: 'Product updates (topic)',
        filters: {
          filters: [
            { field: 'resend_topic_product_updates', operator: 'is_true' },
          ],
          logicalOperator: 'and',
        },
      },
    ])

    // Broadcasts: the draft becomes a Brew draft email; the sent one stays.
    const broadcasts = phase(report, 'broadcasts')
    expect(broadcasts?.items[0]).toMatchObject({
      status: 'done',
      brew: { emailId: expect.stringMatching(/^eml_/) },
    })
    expect(
      broadcasts?.items[0]?.warnings?.map((warning) => warning.code)
    ).toContain('CAMPAIGN_TRIGGER_TAGS')

    const manifest = readManifest(root)
    expect(manifest.phases.contacts).toMatchObject({
      status: 'done',
      cursor: null,
    })
    expect(manifest.phases.templates?.items.map((item) => item.status)).toEqual(
      ['done', 'done']
    )
    // Edit-file steps carry a brew.send replacement for the remaining sends.
    expect(
      report.nextSteps.filter((step) => step.kind === 'edit-file').length
    ).toBeGreaterThan(0)
  })

  it('resumes an interrupted apply from the saved cursor', async () => {
    const root = copyFixture('migrate-resend')
    const clock = fakeClock()
    const resend = useResendApi({ key: RESEND_KEY, clock, pageSize: 1 })
    server.use(resend.handler)
    const brew = useBrewApi({ failContact: 'bob@example.com' })
    const first = await migrate(
      ['--apply', '--yes', '--json', '--only', 'contacts'],
      { cwd: root, env: env(), clock }
    )
    expect(first.code).toBe(1)
    expect(first.report.status).toBe('failed')
    expect(readManifest(root).phases.contacts?.cursor).toBe('ct_1')

    brew.heal()
    const before = resend.requests.length
    const second = await migrate(
      ['--apply', '--yes', '--json', '--only', 'contacts'],
      { cwd: root, env: env(), clock }
    )
    expect(second.code).toBe(0)
    const resumed = resend.requests
      .slice(before)
      .filter((request) => request.path === '/contacts')
    // The first page is not read again.
    expect(resumed[0]?.after).toBe('ct_1')
    expect(readManifest(root).phases.contacts).toMatchObject({
      status: 'done',
      cursor: null,
    })
  })

  it('--rewrite-imports moves only files whose every send is a migrated template', async () => {
    const root = copyFixture('migrate-resend')
    const clock = fakeClock()
    server.use(useResendApi({ key: RESEND_KEY, clock }).handler)
    useBrewApi()
    const digestBefore = readFileSync(join(root, 'src/jobs/digest.cjs'), 'utf8')
    const result = await migrate(
      [
        '--apply',
        '--yes',
        '--json',
        '--rewrite-imports',
        '--only',
        'templates',
        'code',
      ],
      { cwd: root, env: env(), clock }
    )
    expect(result.code).toBe(0)
    const client = readFileSync(join(root, 'src/lib/resend.ts'), 'utf8')
    expect(client).toContain("from '@brew.new/sdk/resend'")
    expect(client).not.toContain("from 'resend'")
    const map = readFileSync(join(root, 'src/lib/brew-resend-map.ts'), 'utf8')
    expect(map).toContain('"reset-password": "reset-password"')
    expect(map).toContain('"tmpl_receipt_1": "receipt"')
    // Raw HTML and attachments stay on Resend until rewritten by hand.
    expect(readFileSync(join(root, 'src/jobs/digest.cjs'), 'utf8')).toBe(
      digestBefore
    )
    expect(
      readFileSync(join(root, 'src/app/api/signup/route.tsx'), 'utf8')
    ).toContain("from 'resend'")
    const manifest = readManifest(root)
    expect(Object.keys(manifest.files)).toEqual(
      expect.arrayContaining([
        'src/lib/brew-resend-map.ts',
        'src/lib/resend.ts',
      ])
    )
  })
})

describe('migrate resend: the SDK the rewritten files need', () => {
  it.each([
    [undefined, true],
    ['^12.3.0', true],
    ['^13.1.0', true],
    ['^13.2.0', false],
  ])(
    'with %s declared, install-sdk is a next step: %s',
    async (declared, expected) => {
      const root = copyFixture('migrate-resend')
      if (declared !== undefined) {
        const path = join(root, 'package.json')
        const manifest = JSON.parse(readFileSync(path, 'utf8')) as {
          dependencies: Record<string, string>
        }
        manifest.dependencies['@brew.new/sdk'] = declared
        writeFileSync(path, JSON.stringify(manifest, null, 2))
      }
      const clock = fakeClock()
      server.use(useResendApi({ key: RESEND_KEY, clock }).handler)
      useBrewApi()
      const result = await migrate(
        [
          '--apply',
          '--yes',
          '--json',
          '--rewrite-imports',
          '--only',
          'templates',
          'code',
        ],
        { cwd: root, env: env(), clock }
      )
      expect(result.code).toBe(0)
      const install = result.report.nextSteps.find(
        (step) => step.id === 'install-sdk'
      )
      expect(install !== undefined).toBe(expected)
      if (expected) {
        expect(install?.command).toContain('@brew.new/sdk@^13.2.0')
      }
    }
  )
})

describe('migrate resend: report-only account', () => {
  it('an empty Resend account plans nothing and still writes a manifest', async () => {
    const root = copyFixture('migrate-resend')
    const clock = fakeClock()
    const empty: ResendAccount = {
      ...RESEND_ACCOUNT,
      domains: [],
      templates: [],
      contacts: [],
      segments: [],
      topics: [],
      suppressions: [],
      broadcasts: [],
      webhooks: [],
      automations: [],
    }
    server.use(useResendApi({ key: RESEND_KEY, clock, account: empty }).handler)
    useBrewApi()
    const result = await migrate(['--json', '--only', 'templates', 'topics'], {
      cwd: root,
      env: env(),
      clock,
    })
    expect(result.code).toBe(0)
    expect(phase(result.report, 'templates')?.detail).toBe(
      'no templates in Resend'
    )
    expect(phase(result.report, 'topics')?.detail).toBe('no topics in Resend')
  })
})
