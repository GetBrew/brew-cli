import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { copyFixture } from '../helpers/fixtures'
import { fakeClock } from '../helpers/login-server'
import {
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
  RESEND_API,
  type ResendAccount,
  useResendApi,
} from '../helpers/resend-api'

/** What a second `migrate resend` run does with what the first one left. */

const APPLY = ['--apply', '--yes', '--json']

function setUp(account: ResendAccount = RESEND_ACCOUNT) {
  const root = copyFixture('migrate-resend')
  const clock = fakeClock()
  server.use(useResendApi({ key: RESEND_KEY, clock, account }).handler)
  return { root, clock, run: { cwd: root, env: env(), clock } }
}

describe('migrate resend: a re-run keeps its destination', () => {
  it('refuses a manifest written for another Brew brand (exit 2)', async () => {
    const { root, run } = setUp()
    useBrewApi()
    expect((await migrate(['--json', '--only', 'domains'], run)).code).toBe(0)
    const before = readFileSync(join(root, 'brew.migration.json'), 'utf8')
    useBrewApi({ brandId: 'bd_other' })
    const second = await migrate(['--json', '--only', 'domains'], run)
    expect(second.code).toBe(2)
    expect(second.stderr).toContain('bd_acme')
    expect(readFileSync(join(root, 'brew.migration.json'), 'utf8')).toBe(before)
  })

  it('refuses another --domain than the one its unsubscribe imports resume on (exit 2)', async () => {
    const { run } = setUp()
    const domains = ['news', 'promo'].map((label) => ({
      domainId: `dom_${label}`,
      name: `${label}.acme.dev`,
      status: 'verified',
      sendingPurpose: 'marketing',
    }))
    useBrewApi({ domains })
    const only = ['--only', 'suppressions', '--domain']
    expect(
      (await migrate([...APPLY, ...only, 'news.acme.dev'], run)).code
    ).toBe(0)
    const second = await migrate([...APPLY, ...only, 'promo.acme.dev'], run)
    expect(second.code).toBe(2)
    expect(second.stderr).toContain('--domain news.acme.dev')
  })
})

describe('migrate resend: unfinished work is retried', () => {
  it('rows Brew refuses keep the phase open until they land', async () => {
    const { root, run } = setUp()
    const brew = useBrewApi({ refuseRow: 'ada@example.com' })
    const first = await migrate([...APPLY, '--only', 'contacts'], run)
    expect(first.code).toBe(1)
    expect(phase(first.report, 'contacts')).toMatchObject({
      status: 'partial',
      error: { code: 'CONTACT_ROWS_FAILED' },
    })

    brew.heal()
    const second = await migrate([...APPLY, '--only', 'contacts'], run)
    expect(second.code).toBe(0)
    expect(readManifest(root).phases.contacts).toMatchObject({
      status: 'done',
      counts: { upserted: 1, failed: 0 },
    })
  })

  it('a topic added since the contact pass sends every contact through it again', async () => {
    const { root, clock } = setUp()
    useBrewApi()
    const run = { cwd: root, env: env(), clock }
    expect((await migrate([...APPLY, '--only', 'topics'], run)).code).toBe(0)

    const account: ResendAccount = {
      ...RESEND_ACCOUNT,
      topics: [
        ...RESEND_ACCOUNT.topics,
        { id: 'top_2', name: 'Events', default_subscription: 'opt_out' },
      ],
      contactTopics: {
        ...RESEND_ACCOUNT.contactTopics,
        ct_1: [{ id: 'top_2', name: 'Events', subscription: 'opt_in' }],
      },
    }
    server.use(useResendApi({ key: RESEND_KEY, clock, account }).handler)
    const brew = useBrewApi()
    expect((await migrate([...APPLY, '--only', 'topics'], run)).code).toBe(0)
    expect(
      brew.calls.some(
        (call) =>
          call.path === '/v1/contacts' &&
          JSON.stringify(call.body).includes('"resend_topic_events":true')
      )
    ).toBe(true)
  })

  it('a Resend key revoked while segment members are read asks for a new key (exit 3)', async () => {
    const { run } = setUp()
    server.use(
      http.get(`${RESEND_API}/segments/:id/contacts`, () =>
        HttpResponse.json(
          {
            statusCode: 401,
            name: 'validation_error',
            message: 'API key is invalid',
          },
          { status: 401 }
        )
      )
    )
    useBrewApi()
    const result = await migrate([...APPLY, '--only', 'segments'], run)
    expect(result.code).toBe(3)
    expect(result.report.status).toBe('auth_required')
    expect(
      result.report.nextSteps.some(
        (step) => step.id === 'resend-full-access-key'
      )
    ).toBe(true)
  })

  it('reuses no audience that selects other contacts', async () => {
    const { run } = setUp()
    const other = {
      filters: [{ field: 'plan', operator: 'equals', value: 'pro' }],
      logicalOperator: 'and',
    }
    const brew = useBrewApi({
      audiences: ['Beta users', 'Beta users (Resend)'].map((name, index) => ({
        audienceId: `aud_other_${index}`,
        audienceName: name,
        filters: other,
        count: 3,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      })),
    })
    const result = await migrate([...APPLY, '--only', 'segments'], run)
    expect(result.code).toBe(1)
    const item = phase(result.report, 'segments')?.items[0]
    expect(item?.status).toBe('failed')
    expect(item?.brew?.audienceId).toBeUndefined()
    expect(
      brew.calls.some(
        (call) => call.method === 'POST' && call.path === '/v1/audiences'
      )
    ).toBe(false)
  })
})

describe('migrate resend: app email keys', () => {
  it('sets up nothing while Brew app emails are unreadable, then plans around the keys Brew has', async () => {
    const { root, run } = setUp()
    const blind = useBrewApi({ appEmailKeys: 'unreadable' })
    const first = await migrate([...APPLY, '--only', 'templates'], run)
    expect(first.code).toBe(1)
    expect(blind.calls.filter((call) => MUTATING.has(call.method))).toEqual([])
    expect(
      readManifest(root).phases.templates?.items.map((item) => item.error?.code)
    ).toEqual(['BREW_APP_EMAILS_UNREADABLE', 'BREW_APP_EMAILS_UNREADABLE'])

    // Another email holds reset-password: the template takes another key.
    const brew = useBrewApi({ appEmailKeys: ['reset-password'] })
    expect((await migrate([...APPLY, '--only', 'templates'], run)).code).toBe(0)
    const setUps = brew.calls
      .filter((call) => call.method === 'PUT')
      .map((call) => call.path)
    expect(setUps).toHaveLength(2)
    expect(setUps).not.toContain('/v1/app-emails/reset-password')
  })
})

describe('migrate resend --rewrite-imports: the template map', () => {
  const REWRITE = [...APPLY, '--rewrite-imports', '--only', 'templates', 'code']
  const MAP = 'src/lib/brew-resend-map.ts'

  it('follows templates added after the clients moved', async () => {
    const { root, clock } = setUp()
    useBrewApi()
    const run = { cwd: root, env: env(), clock }
    expect((await migrate(REWRITE, run)).code).toBe(0)

    const account: ResendAccount = {
      ...RESEND_ACCOUNT,
      templates: [
        ...RESEND_ACCOUNT.templates,
        { id: 'tmpl_new', name: 'Invite', alias: null, status: 'published' },
      ],
      templateDetails: {
        ...RESEND_ACCOUNT.templateDetails,
        tmpl_new: {
          id: 'tmpl_new',
          name: 'Invite',
          alias: null,
          status: 'published',
          subject: 'Join us',
          from: null,
          html: '<p>Join</p>',
          variables: [],
        },
      },
    }
    server.use(useResendApi({ key: RESEND_KEY, clock, account }).handler)
    useBrewApi({ appEmailKeys: ['reset-password', 'receipt'] })
    await migrate(REWRITE, run)
    expect(readFileSync(join(root, MAP), 'utf8')).toContain(
      '"tmpl_new": "invite"'
    )
  })

  it('moves no client to a map the migration did not write', async () => {
    const { root, run } = setUp()
    useBrewApi()
    const client = readFileSync(join(root, 'src/lib/resend.ts'), 'utf8')
    writeFileSync(
      join(root, MAP),
      'export const brewResendTemplates = { "reset-password": "reset" }\n'
    )
    const result = await migrate(REWRITE, run)
    expect(result.code).toBe(1)
    expect(
      result.report.findings.find((finding) => finding.code === 'MAP_FILE_KEPT')
        ?.severity
    ).toBe('error')
    expect(readFileSync(join(root, 'src/lib/resend.ts'), 'utf8')).toBe(client)
  })
})
