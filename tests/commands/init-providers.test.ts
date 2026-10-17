import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { copyFixture } from '../helpers/fixtures'
import {
  configEnv,
  expectValidReport,
  init,
  type Recorded,
  read,
  recordingSpawn,
  useBrewApi,
  webhookUrlFor,
} from '../helpers/init-api'
import { APP_KEY } from '../helpers/login-server'
import { server } from '../helpers/msw-server'

const SUPABASE = 'https://api.supabase.com'
const CLERK = 'https://api.clerk.com/v1'
const REF = 'abcdefghijklmnopqrst'
const SB_TOKEN = 'sbp_0123456789abcdefghijklmnopqrstuvwxyz0123'
const CLERK_SECRET_KEY = 'sk_test_clerkSecret0123456789abcdefghijkl'
const OLD_HOOK_SECRET = 'v1,whsec_b2xkaG9va3NlY3JldGZvcmFub3RoZXJmdW5jdGlvbg=='
const OLD_HOOK_URI =
  'https://abcdefghijklmnopqrst.supabase.co/functions/v1/send-email'

type VendorCall = {
  readonly method: string
  readonly path: string
  readonly body: unknown
  readonly authorization: string | null
}

type HookState = {
  enabled: boolean
  uri: string | null
  secrets: string | null
}

/** The Management API's auth config, holding the Send Email hook. */
function useSupabaseApi(
  initial: HookState,
  options: {
    readonly patchStatus?: number
    readonly beforePatch?: () => void
  } = {}
): { readonly calls: VendorCall[]; readonly hook: HookState } {
  const hook = { ...initial }
  const calls: VendorCall[] = []
  server.use(
    http.get(`${SUPABASE}/v1/projects/:ref/config/auth`, ({ request }) => {
      calls.push({
        method: 'GET',
        path: new URL(request.url).pathname,
        body: undefined,
        authorization: request.headers.get('authorization'),
      })
      return HttpResponse.json({
        site_url: 'http://localhost:3000',
        hook_send_email_enabled: hook.enabled,
        hook_send_email_uri: hook.uri,
        hook_send_email_secrets: hook.secrets,
      })
    }),
    http.patch(
      `${SUPABASE}/v1/projects/:ref/config/auth`,
      async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        calls.push({
          method: 'PATCH',
          path: new URL(request.url).pathname,
          body,
          authorization: request.headers.get('authorization'),
        })
        options.beforePatch?.()
        if (options.patchStatus !== undefined) {
          // A vendor that echoes the secret back must not leak it.
          return HttpResponse.json(
            {
              message: `Invalid hook secret ${String(body.hook_send_email_secrets)} for token ${SB_TOKEN}`,
            },
            { status: options.patchStatus }
          )
        }
        if (typeof body.hook_send_email_enabled === 'boolean') {
          hook.enabled = body.hook_send_email_enabled
        }
        if ('hook_send_email_uri' in body) {
          hook.uri = body.hook_send_email_uri as string | null
        }
        if (typeof body.hook_send_email_secrets === 'string') {
          hook.secrets = body.hook_send_email_secrets
        }
        return HttpResponse.json({})
      }
    )
  )
  return { calls, hook }
}

/** Clerk's email templates and their "Delivered by Clerk" switch. */
function useClerkApi(delivered: Record<string, boolean>): {
  readonly calls: VendorCall[]
  readonly delivered: Record<string, boolean>
} {
  const calls: VendorCall[] = []
  const state = { ...delivered }
  server.use(
    http.get(`${CLERK}/templates/email/:slug`, ({ request, params }) => {
      const slug = String(params.slug)
      calls.push({
        method: 'GET',
        path: new URL(request.url).pathname,
        body: undefined,
        authorization: request.headers.get('authorization'),
      })
      if (!(slug in state)) {
        return HttpResponse.json(
          { errors: [{ message: 'not found', code: 'resource_not_found' }] },
          { status: 404 }
        )
      }
      return HttpResponse.json({
        object: 'template',
        slug,
        delivered_by_clerk: state[slug],
      })
    }),
    http.post(
      `${CLERK}/templates/email/:slug/toggle_delivery`,
      async ({ request, params }) => {
        const body = (await request.json()) as { delivered_by_clerk: boolean }
        calls.push({
          method: 'POST',
          path: new URL(request.url).pathname,
          body,
          authorization: request.headers.get('authorization'),
        })
        state[String(params.slug)] = body.delivered_by_clerk
        return HttpResponse.json({
          object: 'template',
          slug: String(params.slug),
          delivered_by_clerk: body.delivered_by_clerk,
        })
      }
    )
  )
  return { calls, delivered: state }
}

/** Every secret stays out of stdout, stderr and brew.json. */
function expectNoSecrets(
  root: string,
  result: { readonly stdout: string; readonly stderr: string },
  secrets: readonly string[]
): void {
  const state = existsSync(join(root, 'brew.json'))
    ? read(root, 'brew.json')
    : ''
  for (const secret of secrets) {
    expect(result.stdout).not.toContain(secret)
    expect(result.stderr).not.toContain(secret)
    expect(state).not.toContain(secret)
  }
}

/** No Brew request ever carries a provider token. */
function expectBrewNeverSaw(
  requests: readonly Recorded[],
  secrets: readonly string[]
): void {
  const text = JSON.stringify(requests)
  for (const secret of secrets) {
    expect(text).not.toContain(secret)
  }
}

function supabaseProject(): string {
  const root = copyFixture('vite-supabase-lovable')
  writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
  return root
}

function clerkProject(): string {
  const root = copyFixture('react-router-clerk')
  writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
  return root
}

const ACTIVE_CLERK = {
  provider: 'clerk',
  connectionId: 'conn_clerk',
  webhookUrl: webhookUrlFor('clerk'),
  status: 'active',
}

describe('init: Supabase Send Email hook', () => {
  it('without --configure-supabase prints the manual steps and the self-hosted alternative; Supabase is never called', async () => {
    const root = supabaseProject()
    const requests = useBrewApi()
    const supabase = useSupabaseApi({
      enabled: false,
      uri: null,
      secrets: null,
    })
    const result = await init(['--yes', '--json', '--no-test-email'], {
      cwd: root,
      env: configEnv({ SUPABASE_ACCESS_TOKEN: SB_TOKEN }),
      spawn: recordingSpawn().spawn,
    })
    expect(result.code).toBe(0)
    expectValidReport(result.report)
    expect(supabase.calls).toEqual([])
    expect(
      requests.filter((request) => request.path.includes('/integrations/'))
    ).toMatchObject([
      { method: 'GET', path: '/v1/integrations/supabase_auth/connection' },
    ])
    expect(result.report.status).toBe('action_required')
    expect(result.report.providers).toMatchObject([
      { provider: 'supabase_auth', action: 'manual', projectRef: REF },
    ])
    const ids = result.report.nextSteps.map((step) => step.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'connect-supabase-hook',
        'configure-supabase-hook',
        'deploy-supabase-hook',
      ])
    )
    const connect = result.report.nextSteps.find(
      (step) => step.id === 'connect-supabase-hook'
    )
    expect(connect).toMatchObject({ actor: 'human', blocking: true })
    expect(connect?.title).toContain(
      'integrations connect supabase_auth --signing-secret-env SEND_EMAIL_HOOK_SECRET --project-url https://abcdefghijklmnopqrst.supabase.co'
    )
    expect(
      result.report.nextSteps.find((step) => step.id === 'deploy-supabase-hook')
    ).toMatchObject({ blocking: false })
    expectNoSecrets(root, result, [SB_TOKEN])
  })

  it('--configure-supabase is destructive: off a terminal without --yes it exits 4 and calls nothing', async () => {
    const root = supabaseProject()
    const requests = useBrewApi()
    const supabase = useSupabaseApi({
      enabled: false,
      uri: null,
      secrets: null,
    })
    const result = await init(['--configure-supabase', '--json'], {
      cwd: root,
      env: configEnv({ SUPABASE_ACCESS_TOKEN: SB_TOKEN }),
    })
    expect(result.code).toBe(4)
    expect(requests).toEqual([])
    expect(supabase.calls).toEqual([])
    expect(result.json).toMatchObject({
      confirmationRequired: true,
      confirmCommand: 'brew-cli init --configure-supabase --json --yes',
    })
  })

  it('--dry-run --json shows the exact PATCH (secret replaced) and changes nothing', async () => {
    const root = supabaseProject()
    const requests = useBrewApi()
    const supabase = useSupabaseApi({
      enabled: false,
      uri: null,
      secrets: null,
    })
    const result = await init(['--configure-supabase', '--dry-run', '--json'], {
      cwd: root,
      env: configEnv({ SUPABASE_ACCESS_TOKEN: SB_TOKEN }),
      spawn: recordingSpawn().spawn,
    })
    expect(result.code).toBe(0)
    expectValidReport(result.report)
    expect(supabase.calls.map((call) => call.method)).toEqual(['GET'])
    expect(supabase.calls[0]?.authorization).toBe(`Bearer ${SB_TOKEN}`)
    expect(requests.filter((request) => request.method !== 'GET')).toEqual([])
    expect(existsSync(join(root, 'brew.json'))).toBe(false)
    expect(result.report.providers).toEqual([
      {
        provider: 'supabase_auth',
        action: 'planned',
        connection: null,
        projectRef: REF,
        previous: { hook_send_email_enabled: false, hook_send_email_uri: null },
        requests: [
          {
            vendor: 'Brew',
            method: 'PUT',
            url: '/v1/integrations/supabase_auth/connection',
            body: {
              signingSecret: '[generated v1,whsec_ secret, never shown]',
              settings: { projectUrl: `https://${REF}.supabase.co` },
            },
          },
          {
            vendor: 'Supabase',
            method: 'PATCH',
            url: `${SUPABASE}/v1/projects/${REF}/config/auth`,
            body: {
              hook_send_email_enabled: true,
              hook_send_email_uri:
                '<webhookUrl from PUT /v1/integrations/supabase_auth/connection>',
              hook_send_email_secrets:
                '[generated v1,whsec_ secret, never shown]',
            },
          },
        ],
        rollbackCommand: 'brew-cli init --rollback-provider --yes',
        detail: 'dry run',
      },
    ])
    expectNoSecrets(root, result, [SB_TOKEN])
  })

  it('--configure-supabase --yes saves the old hook to brew.json first, connects Brew, then points the hook at it; a re-run changes nothing', async () => {
    const root = supabaseProject()
    const requests = useBrewApi()
    const supabase = useSupabaseApi(
      { enabled: false, uri: null, secrets: null },
      {
        beforePatch: () => {
          // The rollback is on disk before Supabase changes.
          const saved = JSON.parse(read(root, 'brew.json')) as {
            providerConfig?: { supabase_auth?: { previous?: unknown } }
          }
          expect(saved.providerConfig?.supabase_auth?.previous).toEqual({
            hook_send_email_enabled: false,
            hook_send_email_uri: null,
          })
        },
      }
    )
    const result = await init(
      ['--configure-supabase', '--yes', '--json', '--no-test-email'],
      {
        cwd: root,
        env: configEnv({ SUPABASE_ACCESS_TOKEN: SB_TOKEN }),
        spawn: recordingSpawn().spawn,
      }
    )
    expect(result.code).toBe(0)
    expectValidReport(result.report)
    const put = requests.find(
      (request) =>
        request.method === 'PUT' &&
        request.path === '/v1/integrations/supabase_auth/connection'
    )
    const body = put?.body as {
      signingSecret: string
      settings: { projectUrl: string }
    }
    expect(body.signingSecret).toMatch(/^v1,whsec_[A-Za-z0-9+/]{43}=$/)
    expect(body.settings).toEqual({ projectUrl: `https://${REF}.supabase.co` })
    expect(put?.authorization).toBe(`Bearer ${APP_KEY}`)
    const patch = supabase.calls.find((call) => call.method === 'PATCH')
    expect(patch?.body).toEqual({
      hook_send_email_enabled: true,
      hook_send_email_uri: webhookUrlFor('supabase_auth'),
      hook_send_email_secrets: body.signingSecret,
    })
    expect(result.report.providers?.[0]).toMatchObject({
      action: 'configured',
      connection: {
        webhookUrl: webhookUrlFor('supabase_auth'),
        status: 'pending_verification',
      },
      rollbackCommand: 'brew-cli init --rollback-provider --yes',
    })
    expect(
      result.report.steps.find((step) => step.id === 'provider')
    ).toMatchObject({ status: 'done' })
    const state = JSON.parse(read(root, 'brew.json')) as Record<string, unknown>
    expect(state.providerConfig).toEqual({
      supabase_auth: {
        projectRef: REF,
        savedAt: expect.any(String),
        previous: { hook_send_email_enabled: false, hook_send_email_uri: null },
      },
    })
    expect(
      result.report.files.find((file) => file.path === 'brew.json')
    ).toMatchObject({ action: 'created' })
    expectNoSecrets(root, result, [
      SB_TOKEN,
      body.signingSecret,
      body.signingSecret.slice('v1,whsec_'.length),
    ])
    expectBrewNeverSaw(requests, [SB_TOKEN])

    // Re-run: the hook already delivers to Brew, so nothing is sent.
    const again = useBrewApi({
      connections: {
        supabase_auth: {
          provider: 'supabase_auth',
          connectionId: 'conn_supabase_auth',
          webhookUrl: webhookUrlFor('supabase_auth'),
          status: 'active',
        },
      },
    })
    const callsBefore = supabase.calls.length
    const rerun = await init(
      ['--configure-supabase', '--yes', '--json', '--no-test-email'],
      {
        cwd: root,
        env: configEnv({ SUPABASE_ACCESS_TOKEN: SB_TOKEN }),
        spawn: recordingSpawn().spawn,
      }
    )
    expect(rerun.code).toBe(0)
    expect(rerun.report.providers?.[0]).toMatchObject({ action: 'unchanged' })
    expect(
      supabase.calls.slice(callsBefore).map((call) => call.method)
    ).toEqual(['GET'])
    expect(
      again.filter(
        (request) =>
          request.method === 'PUT' && request.path.includes('/integrations/')
      )
    ).toEqual([])
    expect(
      (JSON.parse(read(root, 'brew.json')) as Record<string, unknown>)
        .providerConfig
    ).toEqual(state.providerConfig)
  })

  it('a hook that was on keeps its secret in .env.local (never brew.json), and --rollback-provider puts it all back', async () => {
    const root = supabaseProject()
    useBrewApi()
    const supabase = useSupabaseApi({
      enabled: true,
      uri: OLD_HOOK_URI,
      secrets: OLD_HOOK_SECRET,
    })
    const env = configEnv({ SUPABASE_ACCESS_TOKEN: SB_TOKEN })
    const result = await init(
      ['--configure-supabase', '--yes', '--json', '--no-test-email'],
      { cwd: root, env, spawn: recordingSpawn().spawn }
    )
    expect(result.code).toBe(0)
    expect(read(root, '.env.local')).toContain(
      `BREW_SUPABASE_PREVIOUS_HOOK_SECRETS=${OLD_HOOK_SECRET}`
    )
    expect(supabase.hook.uri).toBe(webhookUrlFor('supabase_auth'))
    expectNoSecrets(root, result, [SB_TOKEN, OLD_HOOK_SECRET])

    // Off a terminal, the rollback asks first.
    const refused = await init(['--rollback-provider', '--json'], {
      cwd: root,
      env,
    })
    expect(refused.code).toBe(4)

    const rollback = await init(['--rollback-provider', '--yes', '--json'], {
      cwd: root,
      env,
    })
    expect(rollback.code).toBe(0)
    expectValidReport(rollback.report)
    expect(supabase.calls.at(-1)).toEqual({
      method: 'PATCH',
      path: `/v1/projects/${REF}/config/auth`,
      body: {
        hook_send_email_enabled: true,
        hook_send_email_uri: OLD_HOOK_URI,
        hook_send_email_secrets: OLD_HOOK_SECRET,
      },
      authorization: `Bearer ${SB_TOKEN}`,
    })
    expect(supabase.hook).toEqual({
      enabled: true,
      uri: OLD_HOOK_URI,
      secrets: OLD_HOOK_SECRET,
    })
    expect(rollback.report.providers).toMatchObject([
      {
        provider: 'supabase_auth',
        action: 'restored',
        requests: [
          {
            vendor: 'Supabase',
            method: 'PATCH',
            body: {
              hook_send_email_enabled: true,
              hook_send_email_uri: OLD_HOOK_URI,
              hook_send_email_secrets:
                '[generated v1,whsec_ secret, never shown]',
            },
          },
        ],
      },
    ])
    const state = JSON.parse(read(root, 'brew.json')) as Record<string, unknown>
    expect(state.providerConfig).toBeUndefined()
    expectNoSecrets(root, rollback, [SB_TOKEN, OLD_HOOK_SECRET])
  })

  it('--rollback-provider --dry-run lists the restore without sending it', async () => {
    const root = supabaseProject()
    useBrewApi()
    const supabase = useSupabaseApi({
      enabled: false,
      uri: null,
      secrets: null,
    })
    const env = configEnv({ SUPABASE_ACCESS_TOKEN: SB_TOKEN })
    await init(['--configure-supabase', '--yes', '--json', '--no-test-email'], {
      cwd: root,
      env,
      spawn: recordingSpawn().spawn,
    })
    const before = supabase.calls.length
    const plan = await init(['--rollback-provider', '--dry-run', '--json'], {
      cwd: root,
      env,
    })
    expect(plan.code).toBe(0)
    expect(supabase.calls.length).toBe(before)
    expect(plan.report.providers?.[0]).toMatchObject({
      action: 'planned',
      requests: [
        {
          method: 'PATCH',
          body: { hook_send_email_enabled: false, hook_send_email_uri: null },
        },
      ],
    })
    expect(
      (JSON.parse(read(root, 'brew.json')) as Record<string, unknown>)
        .providerConfig
    ).toBeDefined()
  })

  it('without SUPABASE_ACCESS_TOKEN it changes nothing and says how to get one', async () => {
    const root = supabaseProject()
    const requests = useBrewApi()
    const supabase = useSupabaseApi({
      enabled: false,
      uri: null,
      secrets: null,
    })
    const result = await init(
      ['--configure-supabase', '--yes', '--json', '--no-test-email'],
      { cwd: root, env: configEnv(), spawn: recordingSpawn().spawn }
    )
    expect(result.code).toBe(0)
    expect(result.report.status).toBe('action_required')
    expect(supabase.calls).toEqual([])
    expect(
      requests.filter(
        (request) =>
          request.method === 'PUT' && request.path.includes('/integrations/')
      )
    ).toEqual([])
    expect(result.report.providers?.[0]).toMatchObject({ action: 'refused' })
    expect(
      result.report.nextSteps.find(
        (step) => step.id === 'supabase-access-token'
      )
    ).toMatchObject({ actor: 'human', kind: 'set-secret', blocking: true })
  })

  it('a Supabase failure exits 1 with the vendor message redacted (no token, no secret)', async () => {
    const root = supabaseProject()
    const requests = useBrewApi()
    useSupabaseApi(
      { enabled: false, uri: null, secrets: null },
      { patchStatus: 403 }
    )
    const result = await init(
      ['--configure-supabase', '--yes', '--json', '--no-test-email'],
      {
        cwd: root,
        env: configEnv({ SUPABASE_ACCESS_TOKEN: SB_TOKEN }),
        spawn: recordingSpawn().spawn,
      }
    )
    expect(result.code).toBe(1)
    expectValidReport(result.report)
    const step = result.report.steps.find((entry) => entry.id === 'provider')
    expect(step?.status).toBe('failed')
    expect(step?.detail).toContain('Supabase answered 403')
    expect(step?.detail).toContain('[redacted]')
    const put = requests.find((request) => request.method === 'PUT')
    const secret = String(
      (put?.body as { signingSecret?: string } | undefined)?.signingSecret
    )
    expect(secret).toMatch(/^v1,whsec_/)
    expectNoSecrets(root, result, [
      SB_TOKEN,
      secret,
      secret.slice('v1,whsec_'.length),
    ])
  })

  it('needs a project ref it can find, and checks --supabase-project before any request', async () => {
    const root = copyFixture('express-resend')
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    useBrewApi()
    const supabase = useSupabaseApi({
      enabled: false,
      uri: null,
      secrets: null,
    })
    const result = await init(
      [
        '--stack',
        'supabase',
        '--configure-supabase',
        '--yes',
        '--json',
        '--no-test-email',
      ],
      {
        cwd: root,
        env: configEnv({ SUPABASE_ACCESS_TOKEN: SB_TOKEN }),
        spawn: recordingSpawn().spawn,
      }
    )
    expect(result.code).toBe(0)
    expect(supabase.calls).toEqual([])
    expect(
      result.report.nextSteps.find((step) => step.id === 'supabase-project')
    ).toMatchObject({ blocking: true })

    const bad = await init(
      ['--configure-supabase', '--supabase-project', 'Not-A-Ref', '--yes'],
      { cwd: root, env: configEnv() }
    )
    expect(bad.code).toBe(2)
    expect(bad.stderr + bad.stdout).toContain('20 lowercase letters')
  })

  it('refuses --configure-supabase on a project whose auth is not Supabase (exit 2)', async () => {
    const root = clerkProject()
    const requests = useBrewApi()
    const result = await init(['--configure-supabase', '--yes', '--json'], {
      cwd: root,
      env: configEnv(),
    })
    expect(result.code).toBe(2)
    expect(requests).toEqual([])
  })
})

describe('init: Clerk delivery', () => {
  const ROUTED = {
    reset_password_code: true,
    magic_link_sign_in: true,
    magic_link_sign_up: true,
    magic_link_user_profile: false,
    verification_code: true,
  }

  it('a bare --yes never touches Clerk, even with an active connection and CLERK_SECRET_KEY', async () => {
    const root = clerkProject()
    useBrewApi({ connections: { clerk: ACTIVE_CLERK } })
    const clerk = useClerkApi(ROUTED)
    const result = await init(['--yes', '--json', '--no-test-email'], {
      cwd: root,
      env: configEnv({ CLERK_SECRET_KEY }),
      spawn: recordingSpawn().spawn,
    })
    expect(result.code).toBe(0)
    expectValidReport(result.report)
    expect(clerk.calls).toEqual([])
    expect(result.report.providers).toMatchObject([
      { provider: 'clerk', action: 'manual' },
    ])
    expect(
      result.report.nextSteps.find(
        (step) => step.id === 'configure-clerk-delivery'
      )
    ).toMatchObject({
      command: 'brew-cli init --configure-clerk --yes',
      blocking: false,
    })
  })

  it('without a Clerk connection, prints how to connect it; Clerk keeps its emails', async () => {
    const root = clerkProject()
    useBrewApi()
    const result = await init(['--yes', '--json', '--no-test-email'], {
      cwd: root,
      env: configEnv(),
      spawn: recordingSpawn().spawn,
    })
    expect(result.code).toBe(0)
    const connect = result.report.nextSteps.find(
      (step) => step.id === 'connect-clerk'
    )
    expect(connect).toMatchObject({ actor: 'human', blocking: false })
    expect(connect?.title).toContain(
      'integrations connect clerk --signing-secret-env CLERK_WEBHOOK_SIGNING_SECRET'
    )
  })

  it('--configure-clerk refuses while the connection is not active: no Clerk call', async () => {
    const root = clerkProject()
    useBrewApi({
      connections: {
        clerk: { ...ACTIVE_CLERK, status: 'pending_verification' },
      },
    })
    const clerk = useClerkApi(ROUTED)
    const result = await init(
      ['--configure-clerk', '--yes', '--json', '--no-test-email'],
      {
        cwd: root,
        env: configEnv({ CLERK_SECRET_KEY }),
        spawn: recordingSpawn().spawn,
      }
    )
    expect(result.code).toBe(0)
    expect(clerk.calls).toEqual([])
    expect(result.report.providers?.[0]).toMatchObject({
      provider: 'clerk',
      action: 'refused',
    })
    expect(
      result.report.steps.find((step) => step.id === 'provider')?.detail
    ).toContain('pending_verification, not active')
    expect(result.report.nextSteps.map((step) => step.id)).toContain(
      'verify-clerk-webhook'
    )
  })

  it('--configure-clerk --dry-run lists the exact toggles and sends none', async () => {
    const root = clerkProject()
    useBrewApi({ connections: { clerk: ACTIVE_CLERK } })
    const clerk = useClerkApi(ROUTED)
    const result = await init(['--configure-clerk', '--dry-run', '--json'], {
      cwd: root,
      env: configEnv({ CLERK_SECRET_KEY }),
      spawn: recordingSpawn().spawn,
    })
    expect(result.code).toBe(0)
    expect(clerk.calls.every((call) => call.method === 'GET')).toBe(true)
    expect(result.report.providers?.[0]).toMatchObject({
      action: 'planned',
      templates: [
        'reset_password_code',
        'magic_link_sign_in',
        'magic_link_sign_up',
      ],
      requests: [
        {
          vendor: 'Clerk',
          method: 'POST',
          url: `${CLERK}/templates/email/reset_password_code/toggle_delivery`,
          body: { delivered_by_clerk: false },
        },
        {
          vendor: 'Clerk',
          method: 'POST',
          url: `${CLERK}/templates/email/magic_link_sign_in/toggle_delivery`,
          body: { delivered_by_clerk: false },
        },
        {
          vendor: 'Clerk',
          method: 'POST',
          url: `${CLERK}/templates/email/magic_link_sign_up/toggle_delivery`,
          body: { delivered_by_clerk: false },
        },
      ],
    })
    expect(existsSync(join(root, 'brew.json'))).toBe(false)
    expectNoSecrets(root, result, [CLERK_SECRET_KEY])
  })

  it('--configure-clerk --yes turns off exactly the templates Brew publishes, saves them, and --rollback-provider turns them back on', async () => {
    const root = clerkProject()
    // The Clerk secret lives in .env.local, as Clerk's quickstarts put it.
    writeFileSync(
      join(root, '.env.local'),
      `BREW_API_KEY=${APP_KEY}\nCLERK_SECRET_KEY=${CLERK_SECRET_KEY}\n`
    )
    const requests = useBrewApi({ connections: { clerk: ACTIVE_CLERK } })
    const clerk = useClerkApi(ROUTED)
    const result = await init(
      ['--configure-clerk', '--yes', '--json', '--no-test-email'],
      { cwd: root, env: configEnv(), spawn: recordingSpawn().spawn }
    )
    expect(result.code).toBe(0)
    expectValidReport(result.report)
    const toggles = clerk.calls.filter((call) => call.method === 'POST')
    expect(toggles).toEqual(
      ['reset_password_code', 'magic_link_sign_in', 'magic_link_sign_up'].map(
        (slug) => ({
          method: 'POST',
          path: `/v1/templates/email/${slug}/toggle_delivery`,
          body: { delivered_by_clerk: false },
          authorization: `Bearer ${CLERK_SECRET_KEY}`,
        })
      )
    )
    // verification_code (auth.otp) has no published app email: untouched.
    expect(clerk.delivered.verification_code).toBe(true)
    expect(requests.some((request) => request.path === '/v1/app-emails')).toBe(
      true
    )
    const state = JSON.parse(read(root, 'brew.json')) as {
      providerConfig?: { clerk?: { templates?: string[] } }
    }
    expect(state.providerConfig?.clerk?.templates).toEqual([
      'magic_link_sign_in',
      'magic_link_sign_up',
      'reset_password_code',
    ])
    expectNoSecrets(root, result, [CLERK_SECRET_KEY])
    expectBrewNeverSaw(requests, [CLERK_SECRET_KEY])

    const rollback = await init(['--rollback-provider', '--yes', '--json'], {
      cwd: root,
      env: configEnv(),
    })
    expect(rollback.code).toBe(0)
    expect(
      clerk.calls
        .filter((call) => call.method === 'POST')
        .slice(3)
        .map((call) => [call.path, call.body])
    ).toEqual(
      ['magic_link_sign_in', 'magic_link_sign_up', 'reset_password_code'].map(
        (slug) => [
          `/v1/templates/email/${slug}/toggle_delivery`,
          { delivered_by_clerk: true },
        ]
      )
    )
    expect(clerk.delivered).toMatchObject({
      reset_password_code: true,
      magic_link_sign_in: true,
      magic_link_sign_up: true,
      magic_link_user_profile: false,
    })
    expect(
      (JSON.parse(read(root, 'brew.json')) as Record<string, unknown>)
        .providerConfig
    ).toBeUndefined()
    expectNoSecrets(root, rollback, [CLERK_SECRET_KEY])
  })

  it('--rollback-provider with nothing saved, or without brew.json, is a usage error (exit 2)', async () => {
    const root = clerkProject()
    const none = await init(['--rollback-provider', '--yes', '--json'], {
      cwd: root,
      env: configEnv(),
    })
    expect(none.code).toBe(2)
    expect(none.stderr + none.stdout).toContain('nothing to roll back')
    writeFileSync(
      join(root, 'brew.json'),
      `${JSON.stringify({ version: 1, projectId: '6f1c1d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f', emails: {}, files: {} })}\n`
    )
    const empty = await init(['--rollback-provider', '--yes', '--json'], {
      cwd: root,
      env: configEnv(),
    })
    expect(empty.code).toBe(2)
    expect(empty.stderr + empty.stdout).toContain('no provider settings')
    expect(readFileSync(join(root, 'brew.json'), 'utf8')).toContain(
      '6f1c1d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f'
    )
  })

  it('--configure-clerk with --configure-supabase or --rollback-provider is a usage error', async () => {
    const root = clerkProject()
    for (const argv of [
      ['--configure-clerk', '--configure-supabase'],
      ['--configure-clerk', '--rollback-provider'],
    ]) {
      const result = await init([...argv, '--yes', '--json'], {
        cwd: root,
        env: configEnv(),
      })
      expect(result.code).toBe(2)
    }
  })
})
