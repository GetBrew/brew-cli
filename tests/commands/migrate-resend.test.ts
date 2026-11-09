import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { copyFixture } from '../helpers/fixtures'
import { fakeClock } from '../helpers/login-server'
import {
  BREW_KEY,
  env,
  MUTATING,
  migrate,
  phase,
  RESEND_KEY,
  readManifest,
  useBrewApi,
} from '../helpers/migrate-resend'
import { server } from '../helpers/msw-server'
import {
  RESEND_ACCOUNT,
  type ResendAccount,
  useResendApi,
} from '../helpers/resend-api'

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
    // Moved by hand, it keeps its props as merge tags like the rest.
    expect(
      code?.items.find((item) => item.file === 'emails/invoice.tsx')?.detail
    ).toContain(
      `app-emails upsert invoice --source-file emails/invoice.tsx --input '{"source":{"props":"merge_tags"}}' --yes`
    )

    // The manifest is written, and the next step applies it.
    const manifest = readManifest(root)
    expect(manifest.brandId).toBe('bd_acme')
    expect(manifest.phases.templates?.items).toHaveLength(2)
    expect(report.nextSteps[0]).toMatchObject({
      id: 'apply',
      blocking: true,
      command: 'brew-cli migrate resend --apply --json --yes',
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

    // Segments and topics: a boolean field each, and an audience on it. A
    // member keeps the state the contacts phase gives it (consent, or
    // unsubscribed); one with no state is left out here too.
    const consent = subscribed.consent
    const segment = upserts.find((call) =>
      JSON.stringify(call.body).includes('"resend_segment_beta_users":true')
    )?.body as { contacts: Array<Record<string, unknown>> }
    expect(segment.contacts).toEqual([
      {
        email: 'ada@example.com',
        customFields: { resend_segment_beta_users: true },
        consent,
      },
      {
        email: 'bob@example.com',
        customFields: { resend_segment_beta_users: true },
        subscribed: false,
      },
    ])
    const topics = upserts.find((call) =>
      JSON.stringify(call.body).includes('resend_topic_product_updates')
    )?.body as { contacts: Array<Record<string, unknown>> }
    expect(topics.contacts).toEqual([
      {
        email: 'ada@example.com',
        customFields: { resend_topic_product_updates: true },
        consent,
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

  it('leaves a key whose trigger another published automation sends from to a person', async () => {
    const root = copyFixture('migrate-resend')
    const clock = fakeClock()
    server.use(useResendApi({ key: RESEND_KEY, clock }).handler)
    const message =
      '"reset-password" already starts the published automation "Reset" (aut_9), which no app-email setup made, so setting it up would send a second email on every fire. Unpublish or delete it, then run the setup again.'
    useBrewApi({
      refuseKeys: {
        'reset-password': {
          status: 409,
          error: {
            code: 'APP_EMAIL_TRIGGER_IN_USE',
            type: 'conflict',
            message,
            details: {
              triggerKey: 'reset-password',
              triggerEventId: 'tri_9',
              automationIds: ['aut_9'],
            },
          },
        },
      },
    })
    const result = await migrate(
      ['--apply', '--yes', '--json', '--only', 'templates'],
      { cwd: root, env: env(), clock }
    )
    expect(result.code).toBe(0)
    const item = readManifest(root).phases.templates?.items.find(
      (entry) => entry.key === 'reset-password'
    )
    expect(item).toMatchObject({
      status: 'manual',
      detail: message,
      error: { code: 'APP_EMAIL_TRIGGER_IN_USE' },
    })
    // Not migrated until the person picks: the run is not complete.
    expect(result.report.status).toBe('action_required')
    expect(
      result.report.nextSteps.find(
        (step) => step.id === 'finish-template:tmpl_reset'
      )
    ).toMatchObject({ actor: 'human', blocking: true })
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
    ['^13.3.0', true],
    ['^13.5.0', true],
    ['^13.6.0', false],
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
        expect(install?.command).toContain('@brew.new/sdk@^13.6.0')
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
