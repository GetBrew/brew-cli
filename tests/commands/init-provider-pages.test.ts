import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import {
  API,
  configEnv,
  init,
  KIT_KEYS,
  recordingSpawn,
  useBrewApi,
} from '../helpers/init-api'
import {
  SB_TOKEN,
  supabaseProject,
  useSupabaseApi,
} from '../helpers/init-providers'
import { server } from '../helpers/msw-server'

/**
 * Before a hosted hook takes the auth emails, init checks each one reaches
 * every user. A brand with many app emails lists them over many pages.
 */

const CONFIGURE = ['--configure-supabase', '--yes', '--json', '--no-test-email']
const PAGES = 25

/** `GET /v1/app-emails` with the kit keys on the last of PAGES pages. */
function useManyAppEmailPages(): string[] {
  const cursors: string[] = []
  server.use(
    http.get(`${API}/v1/app-emails`, ({ request }) => {
      const cursor = new URL(request.url).searchParams.get('cursor')
      cursors.push(cursor ?? '')
      const page = cursor === null ? 0 : Number(cursor.replace('page_', ''))
      const last = page === PAGES - 1
      const keys = last
        ? KIT_KEYS
        : Array.from({ length: 100 }, (_, index) => `custom.p${page}-${index}`)
      return HttpResponse.json({
        data: keys.map((key, index) => ({
          triggerKey: key,
          triggerEventId: `tri_${page}_${index}`,
          title: key,
          emailId: `eml_${page}_${index}`,
          automationId: `aut_${page}_${index}`,
          published: true,
          readiness: { ready: true, teamOnly: false, blockers: [] },
        })),
        pagination: {
          limit: 100,
          cursor: last ? null : `page_${page + 1}`,
          hasMore: !last,
        },
      })
    })
  )
  return cursors
}

describe('init: auth emails listed past many pages', () => {
  it('--configure-supabase finds ready auth emails on a late page and points the hook at Brew', async () => {
    const root = supabaseProject()
    useBrewApi()
    const cursors = useManyAppEmailPages()
    const supabase = useSupabaseApi({
      enabled: false,
      uri: null,
      secrets: null,
    })
    const result = await init(CONFIGURE, {
      cwd: root,
      env: configEnv({ SUPABASE_ACCESS_TOKEN: SB_TOKEN }),
      spawn: recordingSpawn().spawn,
    })
    expect(cursors).toHaveLength(PAGES)
    expect(supabase.calls.map((call) => call.method)).toEqual(['GET', 'PATCH'])
    expect(result.report.providers?.[0]).toMatchObject({
      provider: 'supabase_auth',
      action: 'configured',
    })
  })
})
