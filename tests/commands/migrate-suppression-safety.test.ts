import { readFileSync } from 'node:fs'
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
import { RESEND_ACCOUNT, useResendApi } from '../helpers/resend-api'

describe('provider-wide technical suppression migration', () => {
  it('holds all mutations and transactional code cutover when only host protection exists', async () => {
    const root = copyFixture('migrate-resend')
    const clock = fakeClock()
    server.use(useResendApi({ key: RESEND_KEY, clock }).handler)
    const brew = useBrewApi({ suppressedContacts: [] })
    const file = join(root, 'src/lib/resend.ts')
    const before = readFileSync(file, 'utf8')
    const result = await migrate(
      [
        '--apply',
        '--yes',
        '--json',
        '--domain',
        'news.acme.dev',
        '--rewrite-imports',
      ],
      { cwd: root, env: env(), clock }
    )
    expect(result.report.status).toBe('action_required')
    expect(phase(result.report, 'suppressions')?.status).toBe('manual')
    expect(result.report.nextSteps).toContainEqual(
      expect.objectContaining({ id: 'technical-suppressions', blocking: true })
    )
    expect(brew.calls.filter((call) => MUTATING.has(call.method))).toEqual([])
    expect(readFileSync(file, 'utf8')).toBe(before)
    expect(
      result.report.nextSteps.find((step) => step.id === 'cut-over')?.blocking
    ).toBe(true)
    expect(
      result.report.nextSteps.some(
        (step) =>
          step.kind === 'edit-file' ||
          step.kind === 'set-secret' ||
          step.id === 'verify-send'
      )
    ).toBe(false)
    expect(result.report.agentInstructions).not.toContain(
      'The Resend account is copied into Brew.'
    )
  })

  it('does not trust an old done suppression phase on a later apply', async () => {
    const root = copyFixture('migrate-resend')
    const clock = fakeClock()
    server.use(useResendApi({ key: RESEND_KEY, clock }).handler)
    const brew = useBrewApi()
    await migrate(
      [
        '--apply',
        '--yes',
        '--json',
        '--only',
        'suppressions',
        '--domain',
        'news.acme.dev',
      ],
      { cwd: root, env: env(), clock }
    )
    expect(readManifest(root).phases.suppressions?.status).toBe('done')
    brew.calls.length = 0
    useBrewApi({ suppressedContacts: [] })
    const result = await migrate(
      ['--apply', '--yes', '--json', '--only', 'suppressions'],
      { cwd: root, env: env(), clock }
    )
    expect(result.report.status).toBe('action_required')
    expect(phase(result.report, 'suppressions')?.status).toBe('manual')
  })

  it('allows verified address-level protection without importing it as a host opt-out', async () => {
    const root = copyFixture('migrate-resend')
    const clock = fakeClock()
    server.use(useResendApi({ key: RESEND_KEY, clock }).handler)
    const brew = useBrewApi()
    const result = await migrate(
      ['--apply', '--yes', '--json', '--only', 'suppressions'],
      { cwd: root, env: env(), clock }
    )
    expect(result.report.status).toBe('complete')
    expect(phase(result.report, 'suppressions')?.status).toBe('done')
    expect(
      brew.calls.some(
        (call) =>
          call.path === '/v1/contacts/bounced%40example.com' ||
          call.path === '/v1/contacts/bounced@example.com'
      )
    ).toBe(true)
    expect(brew.calls.filter((call) => MUTATING.has(call.method))).toEqual([])
  })

  it('holds code-only apply without a source audit while leaving source-free planning available', async () => {
    const root = copyFixture('migrate-resend')
    const brew = useBrewApi()
    const result = await migrate(
      ['--apply', '--yes', '--json', '--only', 'code', '--rewrite-imports'],
      { cwd: root, env: env({ RESEND_API_KEY: undefined }) }
    )
    expect(result.report.status).toBe('action_required')
    expect(brew.calls.filter((call) => MUTATING.has(call.method))).toEqual([])
  })

  it.each([404, 503])(
    'never treats an unreadable suppression inventory (%s) as empty',
    async (status) => {
      const root = copyFixture('migrate-resend')
      const clock = fakeClock()
      server.use(useResendApi({ key: RESEND_KEY, clock }).handler)
      server.use(
        http.get('https://api.resend.com/suppressions', () =>
          HttpResponse.json({ message: 'Unavailable' }, { status })
        )
      )
      const brew = useBrewApi()
      const result = await migrate(
        ['--apply', '--yes', '--json', '--only', 'templates'],
        { cwd: root, env: env(), clock }
      )
      expect(result.report.status).not.toBe('complete')
      expect(brew.calls.filter((call) => MUTATING.has(call.method))).toEqual([])
    }
  )

  it('allows an explicitly empty, complete source inventory', async () => {
    const root = copyFixture('migrate-resend')
    const clock = fakeClock()
    server.use(
      useResendApi({
        key: RESEND_KEY,
        clock,
        account: { ...RESEND_ACCOUNT, suppressions: [] },
      }).handler
    )
    const brew = useBrewApi({ suppressedContacts: [] })
    const result = await migrate(
      ['--apply', '--yes', '--json', '--only', 'contacts'],
      { cwd: root, env: env(), clock }
    )
    expect(result.report.status).toBe('complete')
    expect(
      brew.calls.some(
        (call) => call.path === '/v1/contacts' && call.method === 'POST'
      )
    ).toBe(true)
  })

  it('holds a partially read inventory even after the first page is protected', async () => {
    const root = copyFixture('migrate-resend')
    const clock = fakeClock()
    server.use(useResendApi({ key: RESEND_KEY, clock }).handler)
    server.use(
      http.get('https://api.resend.com/suppressions', ({ request }) =>
        new URL(request.url).searchParams.has('after')
          ? HttpResponse.json({ message: 'Unavailable' }, { status: 503 })
          : HttpResponse.json({
              data: RESEND_ACCOUNT.suppressions,
              has_more: true,
            })
      )
    )
    const brew = useBrewApi()
    const result = await migrate(
      ['--apply', '--yes', '--json', '--only', 'contacts'],
      { cwd: root, env: env(), clock }
    )
    expect(result.report.status).toBe('action_required')
    expect(brew.calls.filter((call) => MUTATING.has(call.method))).toEqual([])
  })

  it('rechecks source protection before moving the code path after artifact copies', async () => {
    const root = copyFixture('migrate-resend')
    const clock = fakeClock()
    server.use(useResendApi({ key: RESEND_KEY, clock }).handler)
    let reads = 0
    server.use(
      http.get('https://api.resend.com/suppressions', () =>
        HttpResponse.json({
          data: reads++ === 0 ? [] : RESEND_ACCOUNT.suppressions,
          has_more: false,
        })
      )
    )
    const brew = useBrewApi({ suppressedContacts: [] })
    const file = join(root, 'src/lib/resend.ts')
    const before = readFileSync(file, 'utf8')
    const result = await migrate(
      [
        '--apply',
        '--yes',
        '--json',
        '--only',
        'templates,code',
        '--rewrite-imports',
      ],
      { cwd: root, env: env(), clock }
    )
    expect(result.report.status).toBe('action_required')
    expect(readFileSync(file, 'utf8')).toBe(before)
    expect(
      phase(result.report, 'templates')?.items.some(
        (item) => item.status === 'done'
      )
    ).toBe(true)
    expect(
      brew.calls.some(
        (call) =>
          call.path.startsWith('/v1/app-emails/') && call.method === 'PUT'
      )
    ).toBe(true)
    expect(
      result.report.nextSteps.find((step) => step.id === 'cut-over')?.blocking
    ).toBe(true)
  })

  it('does not treat a global marketing unsubscribe as technical protection', async () => {
    const root = copyFixture('migrate-resend')
    const clock = fakeClock()
    server.use(useResendApi({ key: RESEND_KEY, clock }).handler)
    const brew = useBrewApi()
    server.use(
      http.get('https://brew.new/api/v1/contacts/:email', ({ params }) =>
        HttpResponse.json({
          email: String(params.email),
          subscribed: false,
          suppressed: false,
          customFields: { suppressed: true },
        })
      )
    )
    const result = await migrate(
      ['--apply', '--yes', '--json', '--only', 'contacts'],
      { cwd: root, env: env(), clock }
    )
    expect(result.report.status).toBe('action_required')
    expect(brew.calls.filter((call) => MUTATING.has(call.method))).toEqual([])
  })

  it('holds a final cutover report when the source changes after contact copying', async () => {
    const root = copyFixture('migrate-resend')
    const clock = fakeClock()
    server.use(useResendApi({ key: RESEND_KEY, clock }).handler)
    let reads = 0
    server.use(
      http.get('https://api.resend.com/suppressions', () =>
        HttpResponse.json({
          data: reads++ === 0 ? [] : RESEND_ACCOUNT.suppressions,
          has_more: false,
        })
      )
    )
    const brew = useBrewApi({ suppressedContacts: [] })
    const result = await migrate(
      ['--apply', '--yes', '--json', '--only', 'contacts'],
      { cwd: root, env: env(), clock }
    )
    expect(result.report.status).toBe('action_required')
    expect(
      brew.calls.some(
        (call) => call.path === '/v1/contacts' && call.method === 'POST'
      )
    ).toBe(true)
    expect(phase(result.report, 'contacts')?.status).toBe('done')
    expect(
      result.report.nextSteps.find((step) => step.id === 'cut-over')?.blocking
    ).toBe(true)
  })
})
