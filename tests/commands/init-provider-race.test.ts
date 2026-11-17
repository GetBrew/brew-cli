import { HttpResponse, http } from 'msw'
import { expect, it } from 'vitest'
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
