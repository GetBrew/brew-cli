import {
  existsSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { pendingLoginPath } from '../../src/lib/auth-flow/pending'
import { configPath, readConfig } from '../../src/lib/config-store'
import { CliInterruptError } from '../../src/lib/errors'
import {
  APPROVER_EMAIL,
  BRAND,
  CLI_KEY,
  CLI_KEY_ID,
  fakeClock,
  SESSION_ID,
  sha256,
  T0,
  USER_CODE,
  useLoginServer,
} from '../helpers/login-server'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const VERIFICATION_URL = `https://brew.new/cli/authorize?session=${SESSION_ID}`
const USAGE = { plan: 'growth', credits: { balance: 420 } }

function tempEnv(
  extra: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-login-')),
    ...extra,
  }
}

function recordingOpener(): {
  readonly urls: string[]
  readonly openUrl: (url: string) => Promise<void>
} {
  const urls: string[] = []
  return {
    urls,
    openUrl: async (url) => {
      urls.push(url)
    },
  }
}

type ErrorEnvelope = { error: { code: string; message: string } }

describe('login through the browser', () => {
  it('signs in on an interactive terminal: opens the page, polls, unseals and stores the CLI key', async () => {
    const login = useLoginServer({ steps: ['pending', 'approved'] })
    const env = tempEnv()
    const opener = recordingOpener()
    const clock = fakeClock()
    const result = await runCli(['login', '--json'], {
      env,
      ttyIn: true,
      clock,
      openUrl: opener.openUrl,
    })
    expect(result.code).toBe(0)
    expect(result.json).toEqual({
      loggedIn: true,
      method: 'browser',
      apiKey: 'brew_cli…nop',
      apiUrl: 'https://brew.new/api',
      configPath: configPath(env),
      brandId: BRAND.brandId,
      brandName: BRAND.name,
      userEmail: APPROVER_EMAIL,
      keyId: CLI_KEY_ID,
    })
    expect(readConfig(env)).toEqual({
      apiKey: CLI_KEY,
      brandId: BRAND.brandId,
      userEmail: APPROVER_EMAIL,
      brandName: BRAND.name,
    })
    expect(statSync(configPath(env)).mode & 0o777).toBe(0o600)
    expect(opener.urls).toEqual([VERIFICATION_URL])
    expect(result.stderr).toContain(VERIFICATION_URL)
    expect(result.stderr).toContain('The page is on brew.new')
    expect(result.stderr).toContain(
      `Check the code in your browser matches: ${USER_CODE}`
    )
    expect(result.stderr).toContain(
      `Signed in as ${APPROVER_EMAIL} to ${BRAND.name}`
    )
    // Waited one interval before each poll.
    expect(clock.sleeps).toEqual([2000, 2000])
    expect(login.polls()).toBe(2)

    const [created] = login.createBodies
    expect(created?.keys).toEqual(['cli'])
    expect(created?.publicKey).toMatchObject({ kty: 'EC', crv: 'P-256' })
    expect(created?.publicKey.x).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(created?.publicKey.y).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(created?.client).toMatchObject({ os: process.platform })
    const [secret] = login.pollSecrets
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(sha256(secret ?? '')).toBe(created?.pollSecretHash)
    // The same secret on every poll.
    expect(new Set(login.pollSecrets).size).toBe(1)
  })

  it('backs off five seconds on slow_down and keeps polling until approved', async () => {
    const login = useLoginServer({
      steps: ['pending', 'slow_down', 'approved'],
    })
    const env = tempEnv()
    const clock = fakeClock()
    const result = await runCli(['login', '--browser'], { env, clock })
    expect(result.code).toBe(0)
    expect(clock.sleeps).toEqual([2000, 2000, 7000])
    expect(login.polls()).toBe(3)
    expect(readConfig(env).apiKey).toBe(CLI_KEY)
  })

  it('rides out a 429 (honouring Retry-After) and a 500', async () => {
    useLoginServer({ steps: ['rate_limited', 'server_error', 'approved'] })
    const env = tempEnv()
    const clock = fakeClock()
    const result = await runCli(['login', '--browser'], { env, clock })
    expect(result.code).toBe(0)
    expect(clock.sleeps).toEqual([2000, 7000, 2000])
  })

  it('Ctrl-C while waiting ends with 130 and stores nothing', async () => {
    useLoginServer({ steps: ['pending'] })
    const env = tempEnv()
    const interrupt = new AbortController()
    const clock = fakeClock()
    const result = await runCli(['login', '--browser'], {
      env,
      signal: interrupt.signal,
      clock: {
        now: clock.now,
        sleep: async (ms, signal) => {
          if (clock.sleeps.length === 1) {
            interrupt.abort(new CliInterruptError('SIGINT'))
          }
          await clock.sleep(ms, signal)
        },
      },
    })
    expect(result.code).toBe(130)
    expect(lastError(result.stderr)).toMatchObject({
      code: 'CLI_INTERRUPTED',
      suggestion: 'Nothing was stored on this machine: run the command again.',
    })
    expect(readConfig(env).apiKey).toBeUndefined()
  })

  it('exits 3 when the person denies the request, storing nothing', async () => {
    useLoginServer({ steps: ['pending', 'denied'] })
    const env = tempEnv()
    const result = await runCli(['login', '--browser'], {
      env,
      clock: fakeClock(),
    })
    expect(result.code).toBe(3)
    expect(result.stdout).toBe('')
    const parsed = JSON.parse(result.stderr.trim().split('\n').at(-1) ?? '')
    expect((parsed as ErrorEnvelope).error.code).toBe('CLI_LOGIN_DENIED')
    expect((parsed as ErrorEnvelope).error.message).toContain('denied')
    expect(readConfig(env).apiKey).toBeUndefined()
  })

  it('exits 3 when the server says the session expired', async () => {
    useLoginServer({ steps: ['expired'] })
    const result = await runCli(['login', '--browser'], {
      env: tempEnv(),
      clock: fakeClock(),
    })
    expect(result.code).toBe(3)
    expect(lastError(result.stderr).code).toBe('CLI_LOGIN_EXPIRED')
  })

  it('stops at expiresAt plus a minute when nobody decides', async () => {
    const login = useLoginServer({ steps: ['pending'] })
    const clock = fakeClock()
    const result = await runCli(['login', '--browser'], {
      env: tempEnv(),
      clock,
    })
    expect(result.code).toBe(3)
    expect(lastError(result.stderr).code).toBe('CLI_LOGIN_EXPIRED')
    expect(clock.now()).toBe(T0 + 11 * 60_000)
    // One poll per 2 s across the 11 minutes, no more.
    expect(login.polls()).toBe(330)
  })

  it('treats invalid_grant as final after one poll', async () => {
    const login = useLoginServer({ steps: ['invalid_grant'] })
    const result = await runCli(['login', '--browser'], {
      env: tempEnv(),
      clock: fakeClock(),
    })
    expect(result.code).toBe(3)
    expect(lastError(result.stderr).code).toBe('CLI_LOGIN_INVALID_GRANT')
    expect(login.polls()).toBe(1)
  })

  it('refuses keys sealed for another session', async () => {
    useLoginServer({
      steps: ['approved'],
      sealSessionId: 'AnotherSessionAnotherSession0123',
    })
    const env = tempEnv()
    const result = await runCli(['login', '--browser'], {
      env,
      clock: fakeClock(),
    })
    expect(result.code).toBe(1)
    expect(lastError(result.stderr).code).toBe('CLI_LOGIN_SEAL_INVALID')
    expect(readConfig(env).apiKey).toBeUndefined()
  })

  it('never opens a browser in a cloud shell, but prints the link and still polls', async () => {
    useLoginServer({ steps: ['approved'] })
    const opener = recordingOpener()
    const env = tempEnv({ CODESPACES: 'true' })
    const result = await runCli(['login', '--browser'], {
      env,
      clock: fakeClock(),
      openUrl: opener.openUrl,
    })
    expect(result.code).toBe(0)
    expect(opener.urls).toEqual([])
    expect(result.stderr).toContain('GitHub Codespaces')
    expect(result.stderr).toContain(VERIFICATION_URL)
    expect(readConfig(env).apiKey).toBe(CLI_KEY)
  })

  it('--no-open prints the link without opening it', async () => {
    useLoginServer({ steps: ['approved'] })
    const opener = recordingOpener()
    const result = await runCli(['login', '--no-open'], {
      env: tempEnv(),
      clock: fakeClock(),
      openUrl: opener.openUrl,
    })
    expect(result.code).toBe(0)
    expect(opener.urls).toEqual([])
    expect(result.stderr).toContain(VERIFICATION_URL)
  })

  it('carries on when no browser can be opened', async () => {
    useLoginServer({ steps: ['approved'] })
    const result = await runCli(['login', '--browser'], {
      env: tempEnv(),
      clock: fakeClock(),
    })
    expect(result.code).toBe(0)
    expect(result.stderr).toContain('Could not open a browser here')
  })

  it('starts the session on the --api-url site', async () => {
    const login = useLoginServer({
      origin: 'http://localhost:3000',
      steps: ['approved'],
    })
    const result = await runCli(
      ['login', '--browser', '--api-url', 'http://localhost:3000/api'],
      { env: tempEnv(), clock: fakeClock() }
    )
    expect(result.code).toBe(0)
    expect(login.createBodies).toHaveLength(1)
    expect((result.json as { apiUrl: string }).apiUrl).toBe(
      'http://localhost:3000/api'
    )
  })

  it('a dropped connection says to run it again, not to check for a write', async () => {
    server.use(
      http.post('https://brew.new/api/cli/sessions', () => HttpResponse.error())
    )
    const result = await runCli(['login', '--browser'], {
      env: tempEnv(),
      clock: fakeClock(),
    })
    expect(result.code).toBe(1)
    const error = lastError(result.stderr)
    expect(error.code).toBe('CLI_CONNECTION')
    expect(error.suggestion).toBe(
      'Check the connection, then run the command again.'
    )
  })

  it('exits 3 with a --paste hint when the server has no browser sign-in', async () => {
    useLoginServer({ createStatus: 404 })
    const result = await runCli(['login', '--browser'], {
      env: tempEnv(),
      clock: fakeClock(),
    })
    expect(result.code).toBe(3)
    const error = lastError(result.stderr) as {
      code: string
      suggestion: string
    }
    expect(error.code).toBe('CLI_LOGIN_UNAVAILABLE')
    expect(error.suggestion).toContain('brew-cli login --paste')
  })

  it('whoami shows who approved the stored key', async () => {
    useLoginServer({ steps: ['approved'] })
    server.use(
      http.get('https://brew.new/api/v1/usage', () => HttpResponse.json(USAGE))
    )
    const env = tempEnv()
    await runCli(['login', '--browser'], { env, clock: fakeClock() })
    const whoami = await runCli(['whoami'], { env })
    expect(whoami.code).toBe(0)
    expect(whoami.json).toMatchObject({
      apiKeySource: 'config',
      brandId: BRAND.brandId,
      userEmail: APPROVER_EMAIL,
      brandName: BRAND.name,
    })

    const fromEnv = await runCli(['whoami'], {
      env: { ...env, BREW_API_KEY: 'brew_otherkey0123456789abcdefghijkl' },
    })
    // The stored brand belongs to the stored key: another key never
    // inherits it (it would 403 BRAND_SCOPE_MISMATCH on brand routes).
    expect(fromEnv.json).toMatchObject({
      apiKeySource: 'env',
      userEmail: null,
      brandName: null,
    })
    expect((fromEnv.json as { brandId?: unknown }).brandId ?? null).toBeNull()

    const logout = await runCli(['logout'], { env })
    expect(logout.code).toBe(0)
    expect(readConfig(env)).toEqual({})
  })

  it('a pasted key after a browser sign-in forgets the brand of that sign-in', async () => {
    useLoginServer({ steps: ['approved'] })
    server.use(
      http.get('https://brew.new/api/v1/usage', () => HttpResponse.json(USAGE))
    )
    const env = tempEnv()
    await runCli(['login', '--browser'], { env, clock: fakeClock() })
    expect(readConfig(env).brandId).toBe(BRAND.brandId)
    const pasted = await runCli(
      ['login', '--api-key', 'brew_otherkey0123456789abcdefghijkl'],
      { env }
    )
    expect(pasted.code).toBe(0)
    expect(readConfig(env)).toEqual({
      apiKey: 'brew_otherkey0123456789abcdefghijkl',
    })
  })

  it('a brand id set by hand after a browser sign-in holds for other keys and past logout', async () => {
    useLoginServer({ steps: ['approved'] })
    server.use(
      http.get('https://brew.new/api/v1/usage', () => HttpResponse.json(USAGE))
    )
    const env = tempEnv()
    await runCli(['login', '--browser'], { env, clock: fakeClock() })
    const set = await runCli(['config', 'set', 'brandId', 'bd_other'], { env })
    expect(set.code).toBe(0)
    const fromEnv = await runCli(['whoami'], {
      env: { ...env, BREW_API_KEY: 'brew_otherkey0123456789abcdefghijkl' },
    })
    expect(fromEnv.json).toMatchObject({ brandId: 'bd_other' })
    await runCli(['logout'], { env })
    expect(readConfig(env)).toEqual({ brandId: 'bd_other' })
  })

  it('a key it cannot save says to revoke it and start again', async () => {
    useLoginServer({ steps: ['approved'] })
    const notADirectory = join(
      mkdtempSync(join(tmpdir(), 'brew-cli-login-')),
      'file'
    )
    writeFileSync(notADirectory, '')
    const result = await runCli(['login', '--browser'], {
      env: { BREW_CLI_CONFIG_DIR: join(notADirectory, 'brew-cli') },
      clock: fakeClock(),
    })
    expect(result.code).toBe(1)
    const error = lastError(result.stderr)
    expect(error.code).toBe('CLI_LOGIN_SAVE_FAILED')
    expect(error.suggestion).toContain(
      'Revoke the "CLI · …" key created just now'
    )
  })

  it('a sign-in that stores a key drops an older one still pending', async () => {
    useLoginServer({ steps: ['approved'] })
    server.use(
      http.get('https://brew.new/api/v1/usage', () => HttpResponse.json(USAGE))
    )
    const env = tempEnv()
    await runCli(['login', '--no-wait'], { env, clock: fakeClock() })
    expect(existsSync(pendingLoginPath(env))).toBe(true)
    const browser = await runCli(['login', '--browser'], {
      env,
      clock: fakeClock(),
    })
    expect(browser.code).toBe(0)
    expect(existsSync(pendingLoginPath(env))).toBe(false)

    await runCli(['login', '--no-wait'], { env, clock: fakeClock() })
    const pasted = await runCli(
      ['login', '--api-key', 'brew_otherkey0123456789abcdefghijkl'],
      { env }
    )
    expect(pasted.code).toBe(0)
    expect(existsSync(pendingLoginPath(env))).toBe(false)
  })

  it('shows who approved even under --quiet, and remembers a non-default API URL', async () => {
    useLoginServer({ steps: ['approved'], origin: 'http://localhost:3000' })
    const env = tempEnv()
    const result = await runCli(
      [
        'login',
        '--browser',
        '--quiet',
        '--api-url',
        'http://localhost:3000/api',
      ],
      { env, clock: fakeClock(), ttyOut: true }
    )
    expect(result.code).toBe(0)
    expect(result.stderr).toContain(
      `Signed in as ${APPROVER_EMAIL} to ${BRAND.name}`
    )
    expect(readConfig(env).apiUrl).toBe('http://localhost:3000/api')
  })
})

describe('login --no-wait / --resume (agents)', () => {
  it('prints the pending result and exits 3 at once, then --resume collects the keys', async () => {
    const login = useLoginServer({ steps: ['approved'] })
    const env = tempEnv()
    const opener = recordingOpener()
    const started = await runCli(['login', '--no-wait', '--json'], {
      env,
      clock: fakeClock(),
      openUrl: opener.openUrl,
    })
    expect(started.code).toBe(3)
    expect(started.json).toEqual({
      status: 'pending',
      verificationUrl: VERIFICATION_URL,
      userCode: USER_CODE,
      expiresAt: new Date(T0 + 10 * 60_000).toISOString(),
      resumeCommand: 'brew-cli login --resume --json',
    })
    expect(login.polls()).toBe(0)
    expect(opener.urls).toEqual([VERIFICATION_URL])
    const pendingPath = pendingLoginPath(env)
    expect(statSync(pendingPath).mode & 0o777).toBe(0o600)
    expect(readConfig(env).apiKey).toBeUndefined()

    const resumed = await runCli(['login', '--resume', '--json'], {
      env,
      clock: fakeClock(),
    })
    expect(resumed.code).toBe(0)
    expect(resumed.json).toMatchObject({
      method: 'browser',
      brandId: BRAND.brandId,
      userEmail: APPROVER_EMAIL,
      keyId: CLI_KEY_ID,
    })
    expect(readConfig(env).apiKey).toBe(CLI_KEY)
    expect(existsSync(pendingPath)).toBe(false)
    expect(login.createBodies).toHaveLength(1)
  })

  it('names the launcher in resumeCommand', async () => {
    useLoginServer()
    const result = await runCli(['login', '--no-wait', '--json'], {
      env: tempEnv({ BREW_CLI_INVOKED_AS: 'npx -y brew.new@0.18.0' }),
      clock: fakeClock(),
    })
    expect(result.code).toBe(3)
    expect((result.json as { resumeCommand: string }).resumeCommand).toBe(
      'npx -y brew.new@0.18.0 login --resume --json'
    )
  })

  it('--resume --no-wait polls once and stays pending', async () => {
    const login = useLoginServer({ steps: ['pending'] })
    const env = tempEnv()
    await runCli(['login', '--no-wait'], { env, clock: fakeClock() })
    const check = await runCli(['login', '--resume', '--no-wait'], {
      env,
      clock: fakeClock(T0 + 2000),
    })
    expect(check.code).toBe(3)
    expect(check.json).toMatchObject({ status: 'pending' })
    expect(login.polls()).toBe(1)
    expect(existsSync(pendingLoginPath(env))).toBe(true)
  })

  it('--wait returns the pending result when it runs out first', async () => {
    const login = useLoginServer({ steps: ['pending'] })
    const env = tempEnv()
    const clock = fakeClock()
    const result = await runCli(['login', '--browser', '--wait', '5s'], {
      env,
      clock,
    })
    expect(result.code).toBe(3)
    expect(result.json).toMatchObject({ status: 'pending' })
    // A third poll would go at 6 s: it is left to --resume, not sent early.
    expect(clock.sleeps).toEqual([2000, 2000])
    expect(login.polls()).toBe(2)
    expect(existsSync(pendingLoginPath(env))).toBe(true)
  })

  it('--wait never cuts a Retry-After short', async () => {
    const login = useLoginServer({ steps: ['rate_limited'] })
    const clock = fakeClock()
    const result = await runCli(['login', '--browser', '--wait', '5s'], {
      env: tempEnv(),
      clock,
    })
    expect(result.code).toBe(3)
    expect(clock.sleeps).toEqual([2000])
    expect(login.polls()).toBe(1)
  })

  it('--resume keeps the slower interval an earlier poll was told', async () => {
    const login = useLoginServer({ steps: ['slow_down', 'pending'] })
    const env = tempEnv()
    await runCli(['login', '--browser', '--wait', '5s'], {
      env,
      clock: fakeClock(),
    })
    expect(login.polls()).toBe(1)
    expect(
      JSON.parse(readFileSync(pendingLoginPath(env), 'utf8'))
    ).toMatchObject({ interval: 7, nextPollAt: T0 + 9000 })
    const early = await runCli(['login', '--resume', '--no-wait'], {
      env,
      clock: fakeClock(T0 + 8000),
    })
    expect(early.code).toBe(3)
    expect(login.polls()).toBe(1)
    await runCli(['login', '--resume', '--no-wait'], {
      env,
      clock: fakeClock(T0 + 9000),
    })
    expect(login.polls()).toBe(2)
  })

  it('a denied resume deletes the pending sign-in', async () => {
    useLoginServer({ steps: ['denied'] })
    const env = tempEnv()
    await runCli(['login', '--no-wait'], { env, clock: fakeClock() })
    const resumed = await runCli(['login', '--resume'], {
      env,
      clock: fakeClock(),
    })
    expect(resumed.code).toBe(3)
    expect(lastError(resumed.stderr).code).toBe('CLI_LOGIN_DENIED')
    expect(existsSync(pendingLoginPath(env))).toBe(false)
  })

  it('--resume with nothing pending exits 3', async () => {
    const result = await runCli(['login', '--resume'], { env: tempEnv() })
    expect(result.code).toBe(3)
    expect(lastError(result.stderr).code).toBe('CLI_LOGIN_NOT_PENDING')
  })
})

describe('login flag rules', () => {
  it.each([
    [['--paste', '--browser']],
    [['--paste', '--no-wait']],
    [['--paste', '--resume']],
    [['--api-key', 'brew_abcdefghijklmnopqrstuvwxyz012345', '--browser']],
    [['--api-key', 'brew_abcdefghijklmnopqrstuvwxyz012345', '--paste']],
    [['--wait', '1m', '--no-wait']],
    [['--no-wait', '--wait', '1m']],
    [['--wait', 'soon']],
  ])('exits 2 for login %j', async (flags) => {
    const result = await runCli(['login', ...flags], { env: tempEnv() })
    expect(result.code).toBe(2)
    expect(lastError(result.stderr).code).toBe('CLI_USAGE')
  })

  it('off a terminal with no key, points agents at --no-wait --json', async () => {
    const result = await runCli(['login'], { env: tempEnv() })
    expect(result.code).toBe(2)
    expect(lastError(result.stderr).message).toContain(
      'brew-cli login --no-wait --json'
    )
  })

  it('--paste keeps the old prompt on a terminal', async () => {
    server.use(
      http.get('https://brew.new/api/v1/usage', () => HttpResponse.json(USAGE))
    )
    const env = tempEnv()
    const result = await runCli(['login', '--paste'], {
      env,
      ttyIn: true,
      promptAnswer: 'brew_abcdefghijklmnopqrstuvwxyz012345',
    })
    expect(result.code).toBe(0)
    expect(result.json).toMatchObject({ method: 'paste' })
    expect(readConfig(env).apiKey).toBe('brew_abcdefghijklmnopqrstuvwxyz012345')
  })
})

describe('secrets never reach the terminal', () => {
  it('keeps the key, poll secret and private key off stdout and stderr', async () => {
    const login = useLoginServer({ steps: ['pending', 'approved'] })
    const env = tempEnv()
    const started = await runCli(['login', '--no-wait', '--json'], {
      env,
      clock: fakeClock(),
    })
    const pending = JSON.parse(readFileSync(pendingLoginPath(env), 'utf8')) as {
      pollSecret: string
      privateKey: { d: string }
    }
    const human = await runCli(['login', '--resume', '--no-wait'], {
      env,
      ttyOut: true,
      clock: fakeClock(),
    })
    const resumed = await runCli(['login', '--resume'], {
      env,
      clock: fakeClock(),
    })
    expect(resumed.code).toBe(0)
    const whoami = await runCli(['config', 'list'], { env })
    const secrets = [
      CLI_KEY,
      pending.pollSecret,
      pending.privateKey.d,
      ...login.pollSecrets,
    ]
    for (const run of [started, human, resumed, whoami]) {
      for (const secret of secrets) {
        expect(run.stdout).not.toContain(secret)
        expect(run.stderr).not.toContain(secret)
      }
    }
  })
})

function lastError(stderr: string): {
  code: string
  message: string
  suggestion?: string
} {
  const line = stderr.trim().split('\n').at(-1) ?? ''
  return (JSON.parse(line) as ErrorEnvelope).error
}
