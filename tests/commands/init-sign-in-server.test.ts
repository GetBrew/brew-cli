import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { pendingLoginPath } from '../../src/lib/auth-flow/pending'
import { readConfig } from '../../src/lib/config-store'
import type { SpawnFn } from '../../src/lib/types'
import { copyFixture } from '../helpers/fixtures'
import { CLI_KEY, fakeClock, T0, useLoginServer } from '../helpers/login-server'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

// The approved keys belong to the server that minted them: init never
// sends them, or saves the CLI's, anywhere else.
const LOCAL_SITE = 'http://localhost:3000'
const LOCAL_API = `${LOCAL_SITE}/api`
const QUIET_FLAGS = [
  '--yes',
  '--json',
  '--no-test-email',
  '--no-install',
  '--no-mcp',
  '--no-agent-files',
]

const noGit: SpawnFn = async () => ({
  code: 128,
  stdout: '',
  stderr: 'fatal: not a git repository',
})

function configEnv(): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-init-server-')),
  }
}

describe('init: the signed-in keys stay with their server', () => {
  it('saves the CLI key with the --api-url it signed in against', async () => {
    const root = copyFixture('next-better-auth')
    useLoginServer({ origin: LOCAL_SITE, steps: ['approved'] })
    server.use(
      http.all(`${LOCAL_API}/v1/*`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'NOT_FOUND',
              type: 'not_found',
              message: 'Not in this test.',
            },
          },
          { status: 404 }
        )
      )
    )
    const env = configEnv()
    await runCli(['init', ...QUIET_FLAGS, '--api-url', LOCAL_API], {
      cwd: root,
      env,
      ttyIn: true,
      clock: fakeClock(),
      spawn: noGit,
    })
    expect(readConfig(env)).toMatchObject({
      apiKey: CLI_KEY,
      apiUrl: LOCAL_API,
    })
  })

  it('refuses to resume a sign-in started against another server, before polling', async () => {
    const root = copyFixture('next-better-auth')
    const login = useLoginServer({ origin: LOCAL_SITE, steps: ['approved'] })
    const env = configEnv()
    const started = await runCli(
      ['init', ...QUIET_FLAGS, '--api-url', LOCAL_API],
      { cwd: root, env, clock: fakeClock(), spawn: noGit }
    )
    expect(started.code).toBe(3)

    const resumed = await runCli(['init', ...QUIET_FLAGS, '--resume'], {
      cwd: root,
      env,
      clock: fakeClock(T0 + 2000),
      spawn: noGit,
    })
    expect(resumed.code).toBe(2)
    expect(resumed.stderr).toContain(`--api-url ${LOCAL_API}`)
    expect(login.polls()).toBe(0)
    expect(existsSync(pendingLoginPath(env))).toBe(true)
    expect(existsSync(join(root, '.env.local'))).toBe(false)
    expect(readConfig(env).apiKey).toBeUndefined()
  })
})
