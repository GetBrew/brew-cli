import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { copyFixture } from '../helpers/fixtures'
import {
  configEnv,
  EXPLICIT_KEY,
  expectValidReport,
  init,
  recordingSpawn,
  useBrewApi,
} from '../helpers/init-api'
import { APP_KEY, BRAND, fakeClock } from '../helpers/login-server'

const APP_URL = 'https://my-app.lovable.app'

/** The signed-in brand and the one whose website is the app. */
const TWO_BRANDS = [
  {
    brandId: BRAND.brandId,
    domain: 'acme.com',
    status: 'completed',
    ready: true,
  },
  {
    brandId: 'brand_lovable',
    domain: 'my-app.lovable.app',
    status: 'completed',
    ready: true,
  },
]

/** An app with its key in .env.local, so no sign-in runs. */
function project(): string {
  const root = copyFixture('express-resend')
  writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
  return root
}

describe('init --app-url: the brand', () => {
  it("uses the key's brand when its website matches the app (a subdomain counts)", async () => {
    const root = project()
    const requests = useBrewApi()
    const result = await init(
      [
        '--yes',
        '--json',
        '--no-test-email',
        '--app-url',
        'https://app.acme.com',
      ],
      { cwd: root, env: configEnv(), spawn: recordingSpawn().spawn }
    )
    expect(result.code).toBe(0)
    expectValidReport(result.report)
    expect(result.report.brand).toMatchObject({
      brandId: BRAND.brandId,
      domain: 'acme.com',
      matchesAppUrl: true,
      created: false,
    })
    expect(
      requests.filter((request) => request.path.startsWith('/v1/brands'))
    ).toEqual([])
  })

  it('never moves a key bound to one brand: a mismatch is reported, no brand is created', async () => {
    const root = project()
    const requests = useBrewApi()
    const result = await init(
      ['--yes', '--json', '--no-test-email', '--app-url', APP_URL],
      { cwd: root, env: configEnv(), spawn: recordingSpawn().spawn }
    )
    expect(result.code).toBe(0)
    expect(result.report.brand).toMatchObject({
      brandId: BRAND.brandId,
      matchesAppUrl: false,
    })
    expect(
      requests.filter((request) => request.path.startsWith('/v1/brands'))
    ).toEqual([])
    const step = result.report.nextSteps.find(
      (entry) => entry.id === 'brand-app-url'
    )
    expect(step).toMatchObject({ actor: 'human', blocking: false })
    expect(step?.title).toContain('my-app.lovable.app')
  })

  it("an organization key picks the brand whose website is the app; the app's own key, bound to another brand, holds the kit until it is replaced", async () => {
    const root = project()
    const requests = useBrewApi({
      orgKeyWithoutBrand: true,
      keyBrands: { [APP_KEY]: BRAND.brandId },
      brands: TWO_BRANDS,
    })
    const result = await init(
      [
        ...['--yes', '--json', '--no-test-email', '--app-url', APP_URL],
        ...['--domain', 'mail.my-app.dev'],
      ],
      {
        cwd: root,
        env: configEnv({ BREW_API_KEY: EXPLICIT_KEY }),
        spawn: recordingSpawn().spawn,
      }
    )
    expect(result.code).toBe(0)
    expect(result.report.brand).toMatchObject({
      brandId: 'brand_lovable',
      matchesAppUrl: true,
      created: false,
    })
    expect(
      requests.some(
        (request) => request.method === 'POST' && request.path === '/v1/brands'
      )
    ).toBe(false)
    // .env.local's key still sends from its own brand: no kit or domain
    // lands in either brand while the app could not send from brand_lovable.
    expect(
      requests.some((request) =>
        ['/v1/app-emails/kit', '/v1/domains'].includes(request.path)
      )
    ).toBe(false)
    expect(result.report.status).toBe('action_required')
    expect(
      result.report.nextSteps.find((step) => step.id === 'replace-app-key')
    ).toMatchObject({ actor: 'human', path: '.env.local', blocking: true })
  })

  it('keeps an app key already bound to the brand --app-url picks', async () => {
    const requests = useBrewApi({
      orgKeyWithoutBrand: true,
      keyBrands: { [APP_KEY]: 'brand_lovable' },
      brands: TWO_BRANDS,
    })
    const result = await init(
      ['--yes', '--json', '--no-test-email', '--app-url', APP_URL],
      {
        cwd: project(),
        env: configEnv({ BREW_API_KEY: EXPLICIT_KEY }),
        spawn: recordingSpawn().spawn,
      }
    )
    expect(result.report.nextSteps.map((step) => step.id)).not.toContain(
      'replace-app-key'
    )
    expect(
      requests.some((request) => request.path === '/v1/app-emails/kit')
    ).toBe(true)
  })

  it('an organization key with no matching brand creates one, waits for it, and a re-run finds it instead of creating another', async () => {
    const root = project()
    const requests = useBrewApi({ orgKeyWithoutBrand: true })
    const clock = fakeClock()
    const result = await init(
      ['--yes', '--json', '--no-test-email', '--app-url', APP_URL],
      {
        cwd: root,
        env: configEnv({ BREW_API_KEY: EXPLICIT_KEY }),
        spawn: recordingSpawn().spawn,
        clock,
      }
    )
    expect(result.code).toBe(0)
    expectValidReport(result.report)
    const create = requests.find(
      (request) => request.method === 'POST' && request.path === '/v1/brands'
    )
    expect(create?.body).toEqual({ url: APP_URL })
    expect(create?.idempotencyKey).toMatch(
      /^init:[0-9a-f-]{36}:brand:[0-9a-f]{12}$/
    )
    expect(
      requests.some((request) => request.path === '/v1/brands/brand_new')
    ).toBe(true)
    expect(clock.sleeps.length).toBeGreaterThan(0)
    expect(result.report.brand).toMatchObject({
      brandId: 'brand_new',
      matchesAppUrl: true,
      created: true,
    })
    expect(
      requests.some((request) => request.path === '/v1/app-emails/kit')
    ).toBe(false)

    // The brand exists now: a re-run reuses it.
    const again = useBrewApi({
      orgKeyWithoutBrand: true,
      brands: [
        {
          brandId: 'brand_new',
          domain: 'my-app.lovable.app',
          status: 'completed',
          ready: true,
        },
      ],
    })
    const rerun = await init(
      ['--yes', '--json', '--no-test-email', '--app-url', APP_URL],
      {
        cwd: root,
        env: configEnv({ BREW_API_KEY: EXPLICIT_KEY }),
        spawn: recordingSpawn().spawn,
      }
    )
    expect(rerun.code).toBe(0)
    expect(
      again.some(
        (request) => request.method === 'POST' && request.path === '/v1/brands'
      )
    ).toBe(false)
    expect(rerun.report.brand).toMatchObject({
      brandId: 'brand_new',
      created: false,
    })
  })

  it('--no-wait: the new brand is still being built, so the kit waits for a re-run (exit 0, action required)', async () => {
    const root = project()
    const requests = useBrewApi({ orgKeyWithoutBrand: true })
    const result = await init(
      ['--yes', '--json', '--no-wait', '--app-url', APP_URL],
      {
        cwd: root,
        env: configEnv({ BREW_API_KEY: EXPLICIT_KEY }),
        spawn: recordingSpawn().spawn,
      }
    )
    expect(result.code).toBe(0)
    expectValidReport(result.report)
    expect(result.report.status).toBe('action_required')
    expect(
      requests.some((request) => request.path === '/v1/app-emails/kit')
    ).toBe(false)
    expect(result.report.steps.find((step) => step.id === 'kit')).toMatchObject(
      {
        status: 'skipped',
      }
    )
    expect(result.report.testEmail).toMatchObject({ status: 'skipped' })
    expect(
      result.report.nextSteps.find((step) => step.id === 'brand-extracting')
    ).toMatchObject({ blocking: true })
  })

  it('a key that may not create brands (403) gets a clear next step and the run goes on in its own brand', async () => {
    const root = project()
    const requests = useBrewApi({ createBrandStatus: 403 })
    const result = await init(
      ['--yes', '--json', '--no-test-email', '--app-url', APP_URL],
      {
        cwd: root,
        env: configEnv({ BREW_API_KEY: EXPLICIT_KEY }),
        spawn: recordingSpawn().spawn,
      }
    )
    expect(result.code).toBe(0)
    expect(
      requests.some(
        (request) => request.method === 'POST' && request.path === '/v1/brands'
      )
    ).toBe(true)
    expect(result.report.brand).toMatchObject({
      brandId: BRAND.brandId,
      matchesAppUrl: false,
    })
    const step = result.report.nextSteps.find(
      (entry) => entry.id === 'brand-app-url'
    )
    expect(step?.title).toContain(
      'needs an organization API key with the brands scope (ORG_SCOPE_REQUIRED)'
    )
    expect(step?.title).toContain('BREW_API_KEY=<org key>')
    expect(
      requests.find((request) => request.path === '/v1/app-emails/kit')?.brandId
    ).toBe(null)
  })

  it('a matching brand still being extracted (a re-run after --no-wait) holds the kit too', async () => {
    const root = project()
    const requests = useBrewApi({
      brandDomain: 'my-app.lovable.app',
      brandReady: false,
    })
    const result = await init(
      ['--yes', '--json', '--no-wait', '--app-url', APP_URL],
      { cwd: root, env: configEnv(), spawn: recordingSpawn().spawn }
    )
    expect(result.code).toBe(0)
    expectValidReport(result.report)
    expect(result.report.status).toBe('action_required')
    expect(
      requests.some((request) => request.path === '/v1/app-emails/kit')
    ).toBe(false)
    expect(
      result.report.nextSteps.find((step) => step.id === 'brand-extracting')
    ).toMatchObject({ blocking: true })
  })

  it('--dry-run plans the brand without creating it', async () => {
    const root = project()
    const requests = useBrewApi({ orgKeyWithoutBrand: true })
    const result = await init(['--dry-run', '--json', '--app-url', APP_URL], {
      cwd: root,
      env: configEnv({ BREW_API_KEY: EXPLICIT_KEY }),
      spawn: recordingSpawn().spawn,
    })
    expect(result.code).toBe(0)
    expect(requests.filter((request) => request.method !== 'GET')).toEqual([])
    expect(
      result.report.steps.find((step) => step.id === 'brand')
    ).toMatchObject({
      status: 'planned',
      detail:
        'create a brand for my-app.lovable.app (POST /v1/brands; organization keys only)',
    })
  })
})

describe('init --domain: DNS', () => {
  it('prints the records and the Brew page that adds them automatically (Entri, in the app), with the sandbox until verified', async () => {
    const root = project()
    useBrewApi()
    const result = await init(
      ['--yes', '--json', '--domain', 'mail.acme.com', '--no-test-email'],
      { cwd: root, env: configEnv(), spawn: recordingSpawn().spawn }
    )
    expect(result.code).toBe(0)
    expectValidReport(result.report)
    expect(result.report.domain).toMatchObject({
      mode: 'sandbox',
      added: true,
      connectUrl: 'https://brew.new/domains/dom_new',
      sandbox: { note: expect.stringContaining('team sandbox') },
    })
    const connect = result.report.nextSteps.find(
      (step) => step.id === 'connect-dns-automatically'
    )
    expect(connect).toMatchObject({
      actor: 'human',
      kind: 'open-url',
      url: 'https://brew.new/domains/dom_new',
      blocking: false,
    })
    expect(connect?.title).toContain('runs in the Brew app, not the CLI')
  })
})
