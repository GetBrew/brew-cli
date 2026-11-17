import { spawnSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HttpResponse, http } from 'msw'
import { expect, it } from 'vitest'
import { hostedHookSecretPath } from '../../src/lib/init/providers/hosted-hook-secret'
import { generateHookSecret } from '../../src/lib/init/providers/supabase'
import {
  API,
  configEnv,
  init,
  KIT_KEYS,
  read,
  recordingSpawn,
  useBrewApi,
  webhookUrlFor,
} from '../helpers/init-api'
import {
  OLD_HOOK_SECRET,
  OLD_HOOK_URI,
  REF,
  SB_TOKEN,
  SUPABASE,
  supabaseProject,
  useSupabaseApi,
} from '../helpers/init-providers'
import { BRAND } from '../helpers/login-server'
import { server } from '../helpers/msw-server'

it('a different-machine setup conflict never overwrites the winning Supabase hook', async () => {
  const roots = [supabaseProject(), supabaseProject()]
  useBrewApi()
  const supabase = useSupabaseApi({ enabled: false, uri: null, secrets: null })
  let readCount = 0
  let release: () => void = () => undefined
  const bothRead = new Promise<void>((resolve) => {
    release = resolve
  })
  let acceptedSecret: string | undefined
  server.use(
    http.get(`${SUPABASE}/v1/projects/${REF}/config/auth`, async () => {
      readCount += 1
      if (readCount === 2) release()
      await bothRead
      return HttpResponse.json({
        hook_send_email_enabled: false,
        hook_send_email_uri: null,
      })
    }),
    http.put(
      `${API}/v1/integrations/supabase_auth/connection`,
      async ({ request }) => {
        const body = (await request.json()) as {
          signingSecret: string
          createOnly?: boolean
        }
        expect(body.createOnly).toBe(true)
        if (
          acceptedSecret !== undefined &&
          body.signingSecret !== acceptedSecret
        ) {
          return HttpResponse.json(
            {
              error: {
                code: 'CONFLICT',
                type: 'invalid_request',
                message: 'Another setup connected this brand already.',
              },
            },
            { status: 409 }
          )
        }
        acceptedSecret = body.signingSecret
        return HttpResponse.json({
          provider: 'supabase_auth',
          connectionId: 'conn_supabase_auth',
          webhookUrl: webhookUrlFor('supabase_auth'),
          status: 'pending_verification',
          authEmails: KIT_KEYS.filter((key) => key.startsWith('auth.')).map(
            (triggerKey) => ({ triggerKey, ok: true })
          ),
        })
      }
    )
  )
  const results = await Promise.all(
    roots.map((cwd) =>
      init(['--configure-supabase', '--yes', '--json', '--no-test-email'], {
        cwd,
        env: configEnv({ SUPABASE_ACCESS_TOKEN: SB_TOKEN }),
        spawn: recordingSpawn().spawn,
      })
    )
  )
  expect(
    results.map((result) => result.report.providers?.[0]?.action).sort()
  ).toEqual(['configured', 'failed'])
  expect(supabase.calls.filter((call) => call.method === 'PATCH')).toHaveLength(
    1
  )
  expect(supabase.hook.secrets).toBe(acceptedSecret)
})

it.each([false, true])(
  'reconfigures after rollback only when the saved setup credential matches (changed=%s)',
  async (changed) => {
    const root = supabaseProject()
    const connections: { supabase_auth?: Record<string, unknown> } = {}
    useBrewApi({ connections })
    const supabase = useSupabaseApi({
      enabled: true,
      uri: OLD_HOOK_URI,
      secrets: OLD_HOOK_SECRET,
    })
    const secrets: string[] = []
    server.use(
      http.put(
        `${API}/v1/integrations/supabase_auth/connection`,
        async ({ request }) => {
          const body = (await request.json()) as {
            signingSecret: string
            createOnly: boolean
            settings: { projectUrl: string }
          }
          expect(body.createOnly).toBe(true)
          expect(body.settings).toEqual({
            projectUrl: `https://${REF}.supabase.co`,
          })
          secrets.push(body.signingSecret)
          if (secrets[0] !== body.signingSecret)
            return HttpResponse.json(
              {
                error: {
                  code: 'INTEGRATION_ALREADY_CONNECTED',
                  type: 'invalid_request_error',
                  message: 'Another setup connected this brand already.',
                },
              },
              { status: 409 }
            )
          return HttpResponse.json({
            provider: 'supabase_auth',
            connectionId: 'conn_supabase_auth',
            webhookUrl: webhookUrlFor('supabase_auth'),
            status: 'active',
            authEmails: KIT_KEYS.filter((key) => key.startsWith('auth.')).map(
              (triggerKey) => ({ triggerKey, ok: true })
            ),
          })
        }
      )
    )
    const options = {
      cwd: root,
      env: configEnv({ SUPABASE_ACCESS_TOKEN: SB_TOKEN }),
      spawn: recordingSpawn().spawn,
    }
    const configure = [
      '--configure-supabase',
      '--yes',
      '--json',
      '--no-test-email',
    ]
    expect((await init(configure, options)).report.providers?.[0]?.action).toBe(
      'configured'
    )
    connections.supabase_auth = {
      provider: 'supabase_auth',
      connectionId: 'conn_supabase_auth',
      webhookUrl: webhookUrlFor('supabase_auth'),
      status: 'active',
    }
    expect(
      (await init(['--rollback-provider', '--yes', '--json'], options)).report
        .providers?.[0]?.action
    ).toBe('restored')
    expect(supabase.hook.uri).toBe(OLD_HOOK_URI)
    if (changed)
      writeFileSync(join(root, hostedHookSecretPath(REF)), generateHookSecret())
    const patchesBefore = supabase.calls.filter(
      (call) => call.method === 'PATCH'
    ).length
    const result = await init(configure, options)
    expect(secrets).toHaveLength(2)
    expect(result.report.providers?.[0]?.action).toBe(
      changed ? 'failed' : 'configured'
    )
    expect(
      supabase.calls.filter((call) => call.method === 'PATCH')
    ).toHaveLength(patchesBefore + (changed ? 0 : 1))
    expect(supabase.hook.uri).toBe(
      changed ? OLD_HOOK_URI : webhookUrlFor('supabase_auth')
    )
    if (!changed) expect(secrets[1]).toBe(secrets[0])
  }
)

it('refuses overlapping same-project setup before stale state can erase the rollback', async () => {
  const root = supabaseProject()
  const connections: { supabase_auth?: Record<string, unknown> } = {}
  useBrewApi({ connections })
  const supabase = useSupabaseApi({
    enabled: true,
    uri: OLD_HOOK_URI,
    secrets: OLD_HOOK_SECRET,
  })
  let releaseFirst: () => void = () => undefined
  let firstAtBrand: () => void = () => undefined
  const firstRead = new Promise<void>((resolve) => {
    firstAtBrand = resolve
  })
  const release = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  let brandReads = 0
  server.use(
    http.get(`${API}/v1/brand`, async () => {
      brandReads++
      if (brandReads === 1) {
        firstAtBrand()
        await release
      }
      return HttpResponse.json({
        brandId: BRAND.brandId,
        domain: 'acme.com',
        status: 'completed',
        ready: true,
        identity: { brandName: BRAND.name },
      })
    }),
    http.put(`${API}/v1/integrations/supabase_auth/connection`, () => {
      const connection = {
        provider: 'supabase_auth',
        connectionId: 'conn_supabase_auth',
        webhookUrl: webhookUrlFor('supabase_auth'),
        status: 'active',
        authEmails: KIT_KEYS.filter((key) => key.startsWith('auth.')).map(
          (triggerKey) => ({ triggerKey, ok: true })
        ),
      }
      connections.supabase_auth = connection
      return HttpResponse.json(connection)
    })
  )
  const options = {
    cwd: root,
    env: configEnv({ SUPABASE_ACCESS_TOKEN: SB_TOKEN }),
    spawn: recordingSpawn().spawn,
  }
  const configure = [
    '--configure-supabase',
    '--yes',
    '--json',
    '--no-test-email',
  ]
  const first = init(configure, options)
  await firstRead
  let second: Awaited<ReturnType<typeof init>>
  try {
    const child = spawnSync(
      'bun',
      [
        fileURLToPath(new URL('../../src/bin.ts', import.meta.url)),
        'init',
        ...configure,
        '--no-install',
        '--no-mcp',
        '--api-url',
        'http://127.0.0.1:9',
      ],
      {
        cwd: root,
        env: {
          PATH: process.env.PATH ?? '',
          BREW_CLI_CONFIG_DIR: join(root, '.config-child'),
        },
        encoding: 'utf8',
        timeout: 10_000,
      }
    )
    expect(child.status, child.stderr).toBe(1)
    expect(child.stderr).toContain('Another init is already running')
    // An ordinary init or rollback must not race a provider setup either.
    for (const flags of [[], ['--rollback-provider']]) {
      const result = await init(
        [...flags, '--yes', '--json', '--no-test-email'],
        options
      )
      expect(result.code).toBe(1)
      expect(result.stderr).toContain('Another init is already running')
    }
    second = await init(configure, options)
  } finally {
    releaseFirst()
    await first
  }
  expect((await first).code).toBe(0)
  expect(JSON.parse(read(root, 'brew.json'))).toMatchObject({
    providerConfig: {
      supabase_auth: {
        previous: {
          hook_send_email_enabled: true,
          hook_send_email_uri: OLD_HOOK_URI,
        },
      },
    },
  })
  expect(second.code).toBe(1)
  expect(second.stderr).toContain('Another init is already running')
  expect(brandReads).toBe(1)
  expect(supabase.calls.filter((call) => call.method === 'PATCH')).toHaveLength(
    1
  )
  expect((await init(configure, options)).report.providers?.[0]?.action).toBe(
    'unchanged'
  )
  expect(
    (await init(['--rollback-provider', '--yes', '--json'], options)).report
      .providers?.[0]?.action
  ).toBe('restored')
  expect(supabase.hook.uri).toBe(OLD_HOOK_URI)
})

it('releases the project init lock when state validation fails', async () => {
  const root = supabaseProject()
  useBrewApi()
  useSupabaseApi({ enabled: false, uri: null, secrets: null })
  const options = {
    cwd: root,
    env: configEnv({ SUPABASE_ACCESS_TOKEN: SB_TOKEN }),
    spawn: recordingSpawn().spawn,
  }
  writeFileSync(join(root, 'brew.json'), 'not json')
  const failed = await init(['--yes', '--json', '--no-test-email'], options)
  expect(failed.code).toBe(2)
  expect(existsSync(join(root, '.brew-init.lock'))).toBe(false)
  rmSync(join(root, 'brew.json'))
  expect(
    (
      await init(
        ['--configure-supabase', '--yes', '--json', '--no-test-email'],
        options
      )
    ).report.providers?.[0]?.action
  ).toBe('configured')
  expect(existsSync(join(root, '.brew-init.lock'))).toBe(false)
})

it('keeps dry runs read-only while a project init lock exists', async () => {
  const root = supabaseProject()
  const requests = useBrewApi()
  const supabase = useSupabaseApi({ enabled: false, uri: null, secrets: null })
  writeFileSync(join(root, '.brew-init.lock'), 'held by another init\n')
  const result = await init(['--configure-supabase', '--dry-run', '--json'], {
    cwd: root,
    env: configEnv({ SUPABASE_ACCESS_TOKEN: SB_TOKEN }),
    spawn: recordingSpawn().spawn,
  })
  expect(result.code).toBe(0)
  expect(result.report.dryRun).toBe(true)
  expect(read(root, '.brew-init.lock')).toBe('held by another init\n')
  expect(requests.filter((request) => request.method !== 'GET')).toEqual([])
  expect(supabase.calls.filter((call) => call.method !== 'GET')).toEqual([])
  expect(existsSync(join(root, 'brew.json'))).toBe(false)
})

it.each([false, true])(
  'does not fail or delete another owner when its lock path was recovered (replacement=%s)',
  async (replacement) => {
    const root = supabaseProject()
    useBrewApi()
    const path = join(root, '.brew-init.lock')
    const supabase = useSupabaseApi(
      { enabled: false, uri: null, secrets: null },
      {
        beforePatch: () => {
          rmSync(path)
          if (replacement)
            writeFileSync(path, 'successor owner\n', { flag: 'wx' })
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
    expect(supabase.hook.uri).toBe(webhookUrlFor('supabase_auth'))
    expect(existsSync(path)).toBe(replacement)
    if (replacement)
      expect(read(root, '.brew-init.lock')).toBe('successor owner\n')
  }
)
