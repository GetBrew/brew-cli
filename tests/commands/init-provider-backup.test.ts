import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  configEnv,
  init,
  read,
  recordingSpawn,
  useBrewApi,
} from '../helpers/init-api'
import {
  OLD_HOOK_SECRET,
  OLD_HOOK_URI,
  SB_TOKEN,
  supabaseProject,
  useSupabaseApi,
} from '../helpers/init-providers'

/**
 * `--rollback-provider` restores the hook settings in brew.json with the
 * secret backed up in .env.local: the two must describe the same hook.
 */

const CONFIGURE = ['--configure-supabase', '--yes', '--json', '--no-test-email']
const OTHER_REF = 'zyxwvutsrqponmlkjihg'
const OTHER_SECRET = 'v1,whsec_b3RoZXJwcm9qZWN0aG9va3NlY3JldGJhY2t1cA=='

describe('init: the Supabase hook backup', () => {
  it('a project change refused before its hook changes keeps the saved settings with their secret', async () => {
    const root = supabaseProject()
    const options = {
      cwd: root,
      env: configEnv({ SUPABASE_ACCESS_TOKEN: SB_TOKEN }),
      spawn: recordingSpawn().spawn,
    }
    useBrewApi()
    useSupabaseApi({
      enabled: true,
      uri: OLD_HOOK_URI,
      secrets: OLD_HOOK_SECRET,
    })
    expect((await init(CONFIGURE, options)).code).toBe(0)
    // Another project, whose hook has its own secret; an auth email still
    // reaches the team only, so its hook is left as it is.
    useBrewApi({ teamOnlyKeys: ['auth.magic-link'] })
    useSupabaseApi({
      enabled: true,
      uri: `https://${OTHER_REF}.supabase.co/functions/v1/send-email`,
      secrets: OTHER_SECRET,
    })
    const other = await init(
      [...CONFIGURE, '--supabase-project', OTHER_REF],
      options
    )
    expect(other.report.providers?.[0]).toMatchObject({ action: 'refused' })
    const state = JSON.parse(read(root, 'brew.json')) as {
      providerConfig: { supabase_auth: { projectRef: string } }
    }
    // The backup now describes the other project's hook, secret included.
    expect(state.providerConfig.supabase_auth.projectRef).toBe(OTHER_REF)
    expect(read(root, '.env.local')).toContain(
      `BREW_SUPABASE_PREVIOUS_HOOK_SECRETS=${OTHER_SECRET}`
    )
  })

  it('a project change brew.json cannot save keeps the saved secret beside the saved settings', async () => {
    const root = supabaseProject()
    const options = {
      cwd: root,
      env: configEnv({ SUPABASE_ACCESS_TOKEN: SB_TOKEN }),
      spawn: recordingSpawn().spawn,
    }
    useBrewApi()
    useSupabaseApi({
      enabled: true,
      uri: OLD_HOOK_URI,
      secrets: OLD_HOOK_SECRET,
    })
    expect((await init(CONFIGURE, options)).code).toBe(0)
    // brew.json still reads, but a write is refused: a link outside the
    // project.
    const outside = join(mkdtempSync(join(tmpdir(), 'brew-outside-')), 'b.json')
    writeFileSync(outside, read(root, 'brew.json'))
    rmSync(join(root, 'brew.json'))
    symlinkSync(outside, join(root, 'brew.json'))
    useBrewApi()
    useSupabaseApi({
      enabled: true,
      uri: `https://${OTHER_REF}.supabase.co/functions/v1/send-email`,
      secrets: OTHER_SECRET,
    })
    const other = await init(
      [...CONFIGURE, '--supabase-project', OTHER_REF],
      options
    )
    expect(other.report.providers?.[0]).toMatchObject({ action: 'failed' })
    // The saved settings are still the first project's, and so is the
    // secret a rollback puts back with them.
    expect(read(root, 'brew.json')).not.toContain(OTHER_REF)
    const env = read(root, '.env.local')
    expect(env).toContain(
      `BREW_SUPABASE_PREVIOUS_HOOK_SECRETS=${OLD_HOOK_SECRET}`
    )
    expect(env).not.toContain(OTHER_SECRET)
  })
})
