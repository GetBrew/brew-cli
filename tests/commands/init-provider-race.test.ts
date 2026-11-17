import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { expect, it } from 'vitest'
import { hostedHookSecretPath } from '../../src/lib/init/providers/hosted-hook-secret'
import { generateHookSecret } from '../../src/lib/init/providers/supabase'
import {
  API,
  configEnv,
  init,
  KIT_KEYS,
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
