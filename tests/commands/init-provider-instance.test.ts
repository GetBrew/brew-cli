import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import {
  configEnv,
  init,
  recordingSpawn,
  useBrewApi,
} from '../helpers/init-api'
import {
  ACTIVE_CLERK,
  CLERK,
  CLERK_SECRET_KEY,
  clerkProject,
  useClerkApi,
} from '../helpers/init-providers'
import { server } from '../helpers/msw-server'

describe('Clerk instance binding before disabling delivery', () => {
  it.each(['missing', 'different'] as const)(
    'keeps Clerk sending when instance proof is %s',
    async (proof) => {
      const root = clerkProject()
      const { verifiedInstanceId: _verified, ...unproven } = ACTIVE_CLERK
      useBrewApi({
        connections: { clerk: proof === 'missing' ? unproven : ACTIVE_CLERK },
      })
      const clerk = useClerkApi({ reset_password_code: true })
      server.use(
        http.get(`${CLERK}/instance`, () =>
          HttpResponse.json({ id: 'ins_other' })
        )
      )
      const result = await init(
        ['--configure-clerk', '--yes', '--json', '--no-test-email'],
        {
          cwd: root,
          env: configEnv({ CLERK_SECRET_KEY }),
          spawn: recordingSpawn().spawn,
        }
      )
      expect(result.report.providers).toMatchObject([
        { provider: 'clerk', action: 'refused' },
      ])
      expect(clerk.calls.filter((call) => call.method === 'POST')).toEqual([])
      expect(clerk.delivered.reset_password_code).toBe(true)
    }
  )
})
