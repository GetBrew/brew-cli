import { existsSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pendingLoginPath } from '../../src/lib/auth-flow/pending'
import { readConfig } from '../../src/lib/config-store'
import { validateBrewState } from '../../src/lib/project/state'
import { copyFixture } from '../helpers/fixtures'
import {
  configEnv,
  EXPLICIT_KEY,
  expectValidReport,
  init,
  KIT_KEYS,
  MUTATING,
  type Recorded,
  read,
  recordingSpawn,
  useBrewApi,
} from '../helpers/init-api'
import {
  APP_KEY,
  APPROVER_EMAIL,
  BRAND,
  CLI_KEY,
  fakeClock,
  SESSION_ID,
  USER_CODE,
  useLoginServer,
} from '../helpers/login-server'

describe('init: confirmation and dry run', () => {
  it('exits 4 off a terminal without --yes, with the re-run command', async () => {
    const root = copyFixture('next-better-auth')
    const result = await init(['--json'], { cwd: root, env: configEnv() })
    expect(result.code).toBe(4)
    expect(result.json).toMatchObject({
      confirmationRequired: true,
      command: 'brew-cli init',
      confirmCommand: 'brew-cli init --json --yes',
    })
    expect(existsSync(join(root, 'brew.json'))).toBe(false)
  })

  it('--dry-run reads with an explicit key, sends zero mutating requests, writes nothing', async () => {
    const root = copyFixture('next-better-auth')
    const requests = useBrewApi()
    const spawn = recordingSpawn()
    const before = read(root, 'lib/auth.ts')
    const result = await init(['--dry-run', '--json'], {
      cwd: root,
      env: configEnv({ BREW_API_KEY: EXPLICIT_KEY }),
      spawn: spawn.spawn,
    })
    expect(result.code).toBe(0)
    expectValidReport(result.report)
    expect(result.report.status).toBe('planned')
    expect(result.report.dryRun).toBe(true)
    expect(requests.filter((request) => MUTATING.has(request.method))).toEqual(
      []
    )
    expect(
      requests.map((request) => `${request.method} ${request.path}`)
    ).toEqual([
      'GET /v1/brand',
      'GET /v1/domains',
      'GET /v1/automations/triggers',
    ])
    expect(spawn.calls).toEqual([])
    for (const path of [
      'brew.json',
      '.env.local',
      'lib/brew.ts',
      'AGENTS.md',
      '.cursor/mcp.json',
    ]) {
      expect(existsSync(join(root, path)), path).toBe(false)
    }
    expect(read(root, 'lib/auth.ts')).toBe(before)
    expect(result.report.credential).toMatchObject({
      source: 'env',
      apiKey: 'brew_exp…mno',
      appKey: { status: 'planned' },
    })
    expect(result.report.domain).toMatchObject({
      mode: 'sandbox',
      sandbox: {
        note: expect.stringContaining('members of your Brew organization'),
      },
    })
    expect(result.report.patches.map((patch) => patch.status)).toEqual([
      'pending',
    ])
    expect(
      result.report.steps.find((step) => step.id === 'install')?.detail
    ).toBe("npm install '@brew.new/sdk@^13.2.0'")
  })

  it.each([
    ['^12.3.0', "npm install '@brew.new/sdk@^13.2.0'"],
    ['^13.1.0', "npm install '@brew.new/sdk@^13.2.0'"],
    ['^13.2.0', '@brew.new/sdk ^13.2.0 already declared'],
    ['^14.0.0', '@brew.new/sdk ^14.0.0 already declared'],
  ])(
    '--dry-run with %s declared: install unless it is the generated code range or newer',
    async (declared, detail) => {
      const root = copyFixture('next-better-auth')
      const manifestPath = join(root, 'package.json')
      const manifest = JSON.parse(read(root, 'package.json')) as {
        dependencies?: Record<string, string>
      }
      manifest.dependencies = {
        ...manifest.dependencies,
        '@brew.new/sdk': declared,
      }
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
      useBrewApi()
      const result = await init(['--dry-run', '--json'], {
        cwd: root,
        env: configEnv({ BREW_API_KEY: EXPLICIT_KEY }),
        spawn: recordingSpawn().spawn,
      })
      expect(result.code).toBe(0)
      expect(
        result.report.steps.find((step) => step.id === 'install')?.detail
      ).toBe(detail)
    }
  )

  it('--dry-run without any credential sends no request at all', async () => {
    const root = copyFixture('next-better-auth')
    const result = await init(['--dry-run', '--json'], {
      cwd: root,
      env: configEnv(),
    })
    expect(result.code).toBe(0)
    expectValidReport(result.report)
    expect(result.report.status).toBe('planned')
    expect(result.report.project.projectId).toBeNull()
    expect(
      result.report.steps.find((step) => step.id === 'sign-in')
    ).toMatchObject({ status: 'planned' })
  })
})

describe('init --yes: the full run', () => {
  it('signs in, sets up the kit, installs, writes files and brew.json, sends the test email', async () => {
    const root = copyFixture('next-better-auth')
    const login = useLoginServer({ steps: ['approved'] })
    const requests = useBrewApi()
    const spawn = recordingSpawn()
    const env = configEnv()
    const authBefore = read(root, 'lib/auth.ts')
    const result = await init(['--yes', '--json'], {
      cwd: root,
      env,
      ttyIn: true,
      clock: fakeClock(),
      spawn: spawn.spawn,
    })
    expect(result.code).toBe(0)
    const { report } = result
    expectValidReport(report)
    // The patch to the user's auth config is the one thing left.
    expect(report.status).toBe('action_required')

    // One sign-in for both keys, named after the project.
    expect(login.createBodies).toHaveLength(1)
    expect(login.createBodies[0]?.keys).toEqual(['cli', 'app'])
    expect(login.createBodies[0]?.client).toMatchObject({ project: 'acme-web' })
    // The CLI key goes to the config; the app key only to .env.local.
    expect(readConfig(env)).toMatchObject({
      apiKey: CLI_KEY,
      brandId: BRAND.brandId,
      userEmail: APPROVER_EMAIL,
    })
    const envLocal = read(root, '.env.local')
    expect(envLocal).toBe(`BREW_API_KEY=${APP_KEY}\n`)
    expect(statSync(join(root, '.env.local')).mode & 0o777).toBe(0o600)
    expect(report.credential).toEqual({
      source: 'browser',
      apiKey: 'brew_app…nop',
      appKey: {
        variable: 'BREW_API_KEY',
        file: '.env.local',
        status: 'written',
        masked: 'brew_app…nop',
      },
    })

    const state = validateBrewState(JSON.parse(read(root, 'brew.json')))
    expect(state.ok).toBe(true)
    if (!state.ok) {
      return
    }
    const { projectId } = state.state
    expect(state.state.brandId).toBe(BRAND.brandId)
    expect(state.state.framework).toBe('next-app')
    expect(state.state.auth).toBe('better-auth')
    expect(state.state.contractsPath).toBe('lib/brew-contracts.ts')
    expect(state.state.emails['lifecycle.welcome']).toEqual({
      triggerEventId: 'tri_3',
      automationId: 'aut_3',
    })
    expect(Object.keys(state.state.files).sort()).toEqual([
      'lib/brew-auth.ts',
      'lib/brew-contracts.ts',
      'lib/brew.ts',
    ])
    expect(state.state.mcp).toEqual(['cursor'])
    expect(report.project.projectId).toBe(projectId)

    // Exact API traffic: the app key, pinned to the approved brand.
    expect(
      requests.map((request) => `${request.method} ${request.path}`)
    ).toEqual([
      'GET /v1/domains',
      'POST /v1/app-emails/kit',
      'GET /v1/automations/triggers',
      'POST /v1/automations/triggers/by-key/lifecycle.welcome/fire',
    ])
    for (const request of requests) {
      expect(request.authorization).toBe(`Bearer ${APP_KEY}`)
      expect(request.brandId).toBe(BRAND.brandId)
    }
    const kit = requests[1]
    expect(kit?.body).toEqual({
      sets: ['auth', 'lifecycle'],
      stack: 'better-auth',
    })
    expect(kit?.idempotencyKey).toMatch(
      new RegExp(`^init:${projectId}:kit:[0-9a-f]{12}$`)
    )
    const fire = requests[3]
    expect(fire?.body).toEqual({ payload: { email: APPROVER_EMAIL } })
    expect(fire?.idempotencyKey).toMatch(
      new RegExp(`^init:${projectId}:test-email:[0-9a-f]{12}$`)
    )
    expect(report.testEmail).toEqual({
      status: 'sent',
      key: 'lifecycle.welcome',
      to: APPROVER_EMAIL,
      triggerInstanceId: 'tin_1',
    })

    // The SDK, with the project's package manager.
    expect(spawn.calls).toEqual([
      {
        command: 'npm',
        args: ['install', '@brew.new/sdk@^13.2.0'],
        cwd: root,
      },
    ])

    // Generated files.
    expect(read(root, 'lib/brew.ts')).toContain('export function getBrew()')
    const authHelper = read(root, 'lib/brew-auth.ts')
    expect(authHelper).toContain("import { after } from 'next/server'")
    expect(authHelper).toContain('waitUntil: after,')
    const contracts = read(root, 'lib/brew-contracts.ts')
    expect(contracts).toContain("declare module '@brew.new/sdk' {")
    expect(contracts).toContain('"lifecycle.welcome": WelcomePayload')
    expect(read(root, '.env.example')).toBe('BREW_API_KEY=\n')
    const agents = read(root, 'AGENTS.md')
    expect(agents).toContain('<!-- brew:start -->')
    expect(agents).toContain('`lifecycle.welcome`')
    expect(agents).not.toContain(APP_KEY)
    // No Claude Code here: no .claude/ directory appears.
    expect(existsSync(join(root, '.claude'))).toBe(false)
    expect(JSON.parse(read(root, '.cursor/mcp.json'))).toEqual({
      mcpServers: { brew: { url: 'https://brew.new/api/mcp' } },
    })

    // The user's auth config is patched only on request.
    expect(read(root, 'lib/auth.ts')).toBe(authBefore)
    expect(report.patches[0]).toMatchObject({
      id: 'better-auth-config',
      path: 'lib/auth.ts',
      status: 'pending',
    })
    expect(report.nextSteps.find((step) => step.blocking)).toMatchObject({
      id: 'apply-better-auth-config',
      actor: 'agent',
      kind: 'apply-patch',
      patchId: 'better-auth-config',
      // Pinned to the reviewed file: the hash of lib/auth.ts it was computed on.
      command: `brew-cli init --json --apply-patches better-auth-config@${report.patches[0]?.baseSha256?.slice(0, 12)} --yes`,
    })
    expect(report.domain).toMatchObject({ mode: 'sandbox' })
    expect(report.nextSteps.map((step) => step.id)).toContain('verify-domain')
    expect(report.emails.map((email) => email.key)).toEqual(KIT_KEYS)

    // Re-run: nothing changes, the same idempotency keys, no sign-in.
    const firstState = read(root, 'brew.json')
    const again = useBrewApi()
    const rerun = await init(['--yes', '--json'], {
      cwd: root,
      env,
      spawn: recordingSpawn().spawn,
    })
    expect(rerun.code).toBe(0)
    expectValidReport(rerun.report)
    expect(read(root, 'brew.json')).toBe(firstState)
    expect(login.createBodies).toHaveLength(1)
    expect(rerun.report.credential.source).toBe('env-file')
    expect(rerun.report.credential.appKey.status).toBe('existing')
    expect(
      rerun.report.files
        .filter((file) => file.role !== 'agents-block')
        .map((file) => [file.path, file.action])
    ).toEqual([
      ['lib/brew.ts', 'unchanged'],
      ['lib/brew-auth.ts', 'unchanged'],
      ['lib/brew-contracts.ts', 'unchanged'],
      ['.env.example', 'unchanged'],
      ['brew.json', 'unchanged'],
    ])
    expect(
      rerun.report.files.find((file) => file.path === 'AGENTS.md')?.action
    ).toBe('unchanged')
    expect(rerun.report.mcp).toMatchObject([
      { client: 'cursor', action: 'unchanged' },
    ])
    const keysOf = (list: Recorded[]) =>
      list
        .filter((request) => request.method === 'POST')
        .map((request) => request.idempotencyKey)
    expect(keysOf(again)).toEqual(keysOf(requests))
    expect(again.every((request) => request.brandId === BRAND.brandId)).toBe(
      true
    )
  })

  it('--apply-patches wires Better Auth when the file is unchanged, and a re-run finds it applied', async () => {
    const root = copyFixture('next-better-auth')
    useBrewApi()
    const env = configEnv({ BREW_API_KEY: EXPLICIT_KEY })
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    const reviewed = await init(
      ['--yes', '--json', '--no-test-email', '--no-install'],
      { cwd: root, env, spawn: recordingSpawn().spawn }
    )
    const pin = `better-auth-config@${reviewed.report.patches[0]?.baseSha256?.slice(0, 12)}`
    useBrewApi()
    const result = await init(
      [
        '--yes',
        '--json',
        '--apply-patches',
        pin,
        '--no-test-email',
        '--no-install',
      ],
      { cwd: root, env, spawn: recordingSpawn().spawn }
    )
    expect(result.code).toBe(0)
    expect(result.report.patches[0]?.status).toBe('applied')
    expect(read(root, 'lib/auth.ts')).toBe(
      [
        "import { betterAuth } from 'better-auth'",
        "import { db } from './db'",
        "import { brewEmails } from './brew-auth'",
        '',
        'export const auth = betterAuth({',
        '  emailVerification: { sendVerificationEmail: brewEmails.sendVerificationEmail },',
        '  databaseHooks: { user: { create: { after: brewEmails.onUserCreated } } },',
        '  database: db,',
        '  emailAndPassword: {',
        '    sendResetPassword: brewEmails.sendResetPassword,',
        '    enabled: true,',
        '  },',
        '})',
        '',
      ].join('\n')
    )
    // An explicit key acts; the project's own key stays where it is.
    expect(result.report.credential.source).toBe('env')
    expect(result.report.credential.appKey.status).toBe('existing')
    expect(
      result.report.nextSteps.find((step) => step.id === 'install-sdk')
    ).toMatchObject({
      blocking: true,
      command: "npm install '@brew.new/sdk@^13.2.0'",
    })

    useBrewApi()
    const rerun = await init(
      ['--yes', '--json', '--no-test-email', '--no-install'],
      {
        cwd: root,
        env,
        spawn: recordingSpawn().spawn,
      }
    )
    expect(rerun.report.patches[0]?.status).toBe('already-applied')
  })

  it('--apply-patches leaves a file edited since the report alone (stale)', async () => {
    const root = copyFixture('next-better-auth')
    useBrewApi()
    const env = configEnv({ BREW_API_KEY: EXPLICIT_KEY })
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    const reviewed = await init(
      ['--yes', '--json', '--no-test-email', '--no-install'],
      { cwd: root, env, spawn: recordingSpawn().spawn }
    )
    const pin = `better-auth-config@${reviewed.report.patches[0]?.baseSha256?.slice(0, 12)}`
    const edited = `${read(root, 'lib/auth.ts')}// edited after the review\n`
    writeFileSync(join(root, 'lib/auth.ts'), edited)
    useBrewApi()
    const result = await init(
      [
        '--yes',
        '--json',
        '--apply-patches',
        pin,
        '--no-test-email',
        '--no-install',
      ],
      { cwd: root, env, spawn: recordingSpawn().spawn }
    )
    expect(result.report.patches[0]?.status).toBe('stale')
    expect(read(root, 'lib/auth.ts')).toBe(edited)
    expect(
      result.report.nextSteps.find(
        (step) => step.id === 'apply-better-auth-config'
      )?.command
    ).not.toContain(pin)
  })

  it('--apply-patches refuses a value that is not <id>@<hash> (exit 2)', async () => {
    const root = copyFixture('next-better-auth')
    const result = await init(['--yes', '--json', '--apply-patches', 'all'], {
      cwd: root,
      env: configEnv(),
      spawn: recordingSpawn().spawn,
    })
    expect(result.code).toBe(2)
  })

  it('keeps a generated file someone edited, and says so', async () => {
    const root = copyFixture('express-resend')
    useBrewApi()
    const env = configEnv({ BREW_API_KEY: EXPLICIT_KEY })
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    const options = { cwd: root, env, spawn: recordingSpawn().spawn }
    await init(['--yes', '--json', '--no-test-email'], options)
    const edited = `${read(root, 'src/lib/brew.ts')}// mine\n`
    writeFileSync(join(root, 'src/lib/brew.ts'), edited)
    useBrewApi()
    const rerun = await init(['--yes', '--json', '--no-test-email'], options)
    expect(read(root, 'src/lib/brew.ts')).toBe(edited)
    expect(
      rerun.report.files.find((file) => file.path === 'src/lib/brew.ts')
    ).toMatchObject({
      action: 'kept-user-version',
      note: 'edited since the CLI wrote it',
    })
    // ESM Node server: relative imports carry .js.
    expect(read(root, 'src/lib/brew-auth.ts')).toContain("from './brew.js'")
  })

  it('in a Claude Code project, installs the skills and the .mcp.json entry', async () => {
    const root = copyFixture('express-resend')
    useBrewApi()
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    const result = await init(['--yes', '--json', '--no-test-email'], {
      cwd: root,
      env: configEnv({ CLAUDECODE: '1' }),
      spawn: recordingSpawn().spawn,
    })
    expect(result.code).toBe(0)
    expect(read(root, '.claude/skills/brew-app-emails/SKILL.md')).toContain(
      'name: brew-app-emails'
    )
    expect(read(root, 'AGENTS.md')).toContain(
      '- Skill: `.claude/skills/brew-app-emails/SKILL.md`.'
    )
    expect(result.report.mcp).toMatchObject([
      { client: 'claude-code', path: '.mcp.json', action: 'created' },
    ])
  })

  it('a changed request gets a new idempotency key under the same project id', async () => {
    const root = copyFixture('express-resend')
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    const options = {
      cwd: root,
      env: configEnv(),
      spawn: recordingSpawn().spawn,
    }
    const first = useBrewApi()
    const created = await init(['--yes', '--json', '--no-test-email'], options)
    // No .gitignore yet: init creates one that ignores .env.local.
    expect(
      created.report.files.find((file) => file.path === '.gitignore')
    ).toEqual({
      path: '.gitignore',
      action: 'created',
      role: 'gitignore',
      note: 'ignores .env.local',
    })
    expect(read(root, '.gitignore')).toBe(
      '# brew:start\n.env.local\n# brew:end\n'
    )
    const second = useBrewApi()
    await init(
      ['--yes', '--json', '--no-test-email', '--sets', 'lifecycle'],
      options
    )
    const kitKey = (list: Recorded[]) =>
      list.find((request) => request.path === '/v1/app-emails/kit')
        ?.idempotencyKey ?? ''
    expect(kitKey(second)).not.toBe(kitKey(first))
    expect(kitKey(second).split(':').slice(0, 3)).toEqual(
      kitKey(first).split(':').slice(0, 3)
    )
    expect(
      second.find((request) => request.path === '/v1/app-emails/kit')?.body
    ).toEqual({ sets: ['lifecycle'], stack: 'custom' })
  })

  it('Supabase Edge Functions only: the hook and a Deno client, nothing to install', async () => {
    const root = copyFixture('supabase-functions')
    useBrewApi()
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    const spawn = recordingSpawn()
    const result = await init(['--yes', '--json', '--no-test-email'], {
      cwd: root,
      env: configEnv(),
      spawn: spawn.spawn,
    })
    expect(result.code).toBe(0)
    expectValidReport(result.report)
    expect(spawn.calls).toEqual([])
    expect(read(root, 'supabase/functions/_shared/brew.ts')).toContain(
      "Deno.env.get('BREW_API_KEY')"
    )
    expect(read(root, 'supabase/functions/send-email/index.ts')).toContain(
      'npm:@brew.new/sdk@^13.2.0/supabase'
    )
    expect(result.report.patches).toMatchObject([
      { id: 'supabase-config-hook', status: 'pending' },
    ])
  })

  it('adds a sending domain with --domain and prints its DNS records, without waiting', async () => {
    const root = copyFixture('express-resend')
    const requests = useBrewApi()
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    const result = await init(
      ['--yes', '--json', '--domain', 'mail.acme.com', '--no-test-email'],
      { cwd: root, env: configEnv(), spawn: recordingSpawn().spawn }
    )
    expect(result.code).toBe(0)
    const add = requests.find(
      (request) => request.method === 'POST' && request.path === '/v1/domains'
    )
    expect(add?.body).toEqual({
      name: 'mail.acme.com',
      sendingPurpose: 'transactional',
    })
    expect(add?.idempotencyKey).toMatch(
      /^init:[0-9a-f-]{36}:domain:[0-9a-f]{12}$/
    )
    expect(result.report.domain).toMatchObject({
      mode: 'sandbox',
      domainId: 'dom_new',
      name: 'mail.acme.com',
      added: true,
      records: [
        {
          type: 'TXT',
          name: 'brew._domainkey.mail.acme.com',
          value: 'p=MIGf…',
        },
      ],
    })
    expect(
      result.report.nextSteps.find((step) => step.id === 'add-dns-records')
    ).toMatchObject({
      actor: 'human',
      command: 'brew-cli domains verify dom_new',
      blocking: false,
    })
  })

  it('points at a subdomain when the added domain already publishes another DKIM key', async () => {
    const root = copyFixture('express-resend')
    useBrewApi({
      addWarnings: [
        {
          code: 'DKIM_SELECTOR_IN_USE',
          message: 'acme.com already publishes a different DKIM key.',
          suggestedNames: ['mail.acme.com', 'send.acme.com'],
        },
      ],
    })
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    const result = await init(
      ['--yes', '--json', '--domain', 'acme.com', '--no-test-email'],
      { cwd: root, env: configEnv(), spawn: recordingSpawn().spawn }
    )
    expect(result.code).toBe(0)
    expectValidReport(result.report)
    const ids = result.report.nextSteps.map((step) => step.id)
    expect(ids).not.toContain('add-dns-records')
    // Connect automatically would publish the same clashing DKIM record.
    expect(ids).not.toContain('connect-dns-automatically')
    expect(
      result.report.nextSteps.find((step) => step.id === 'dkim-selector-in-use')
    ).toEqual({
      id: 'dkim-selector-in-use',
      actor: 'human',
      kind: 'run-command',
      title:
        'acme.com already publishes a different DKIM key where Brew asks for its record: add a subdomain instead (mail.acme.com, send.acme.com)',
      command: 'brew-cli init --domain mail.acme.com',
      blocking: false,
    })
  })

  it('exits 1 with the report when a kit key failed, pointing at a re-run', async () => {
    const root = copyFixture('express-resend')
    useBrewApi({ failKeys: ['auth.magic-link'] })
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    const result = await init(['--yes', '--json'], {
      cwd: root,
      env: configEnv(),
      spawn: recordingSpawn().spawn,
    })
    expect(result.code).toBe(1)
    expectValidReport(result.report)
    expect(result.report.status).toBe('failed')
    expect(result.report.emails.find((email) => !email.ok)).toEqual({
      key: 'auth.magic-link',
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Import failed.' },
    })
    expect(
      result.report.nextSteps.find((step) => step.id === 'rerun-init')
    ).toMatchObject({
      command: 'brew-cli init --json --yes',
      blocking: true,
    })
  })

  it('asks a person about a key whose trigger another published automation sends from', async () => {
    const root = copyFixture('express-resend')
    const message =
      '"lifecycle.welcome" already starts the published automation "Welcome" (aut_9), which no app-email setup made, so setting it up would send a second email on every fire. Unpublish or delete it, then run the setup again.'
    useBrewApi({
      refusals: {
        'lifecycle.welcome': { code: 'APP_EMAIL_TRIGGER_IN_USE', message },
      },
    })
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    const result = await init(['--yes', '--json', '--no-test-email'], {
      cwd: root,
      env: configEnv(),
      spawn: recordingSpawn().spawn,
    })
    expect(result.code).toBe(1)
    expectValidReport(result.report)
    const ids = result.report.nextSteps.map((step) => step.id)
    expect(
      result.report.nextSteps.find(
        (step) => step.id === 'trigger-in-use:lifecycle.welcome'
      )
    ).toEqual({
      id: 'trigger-in-use:lifecycle.welcome',
      actor: 'human',
      kind: 'review',
      title: `lifecycle.welcome: ${message}`,
      blocking: false,
    })
    // The person decides first; then a re-run finishes the key.
    expect(ids.indexOf('trigger-in-use:lifecycle.welcome')).toBeLessThan(
      ids.indexOf('rerun-init')
    )
  })
})

describe('init: sign-in for agents (exit 3)', () => {
  it('off a terminal, starts the sign-in, exits 3 with the link, then --resume finishes', async () => {
    const root = copyFixture('next-better-auth')
    const login = useLoginServer({ steps: ['approved'] })
    const env = configEnv()
    const pending = await init(['--yes', '--json', '--no-test-email'], {
      cwd: root,
      env,
      clock: fakeClock(),
      spawn: recordingSpawn().spawn,
    })
    expect(pending.code).toBe(3)
    expectValidReport(pending.report)
    expect(pending.report.status).toBe('auth_required')
    expect(pending.report.nextSteps).toEqual([
      {
        id: 'approve-sign-in',
        actor: 'human',
        kind: 'open-url',
        url: `https://brew.new/cli/authorize?session=${SESSION_ID}`,
        title: expect.stringContaining(USER_CODE),
        blocking: true,
      },
      {
        id: 'resume-init',
        actor: 'agent',
        kind: 'run-command',
        command: 'brew-cli init --json --no-test-email --resume --yes',
        title: expect.any(String),
        blocking: true,
      },
    ])
    expect(login.polls()).toBe(0)
    expect(existsSync(pendingLoginPath(env))).toBe(true)
    expect(existsSync(join(root, 'brew.json'))).toBe(false)
    expect(existsSync(join(root, '.env.local'))).toBe(false)

    const requests = useBrewApi()
    const resumed = await init(
      ['--json', '--no-test-email', '--resume', '--yes'],
      {
        cwd: root,
        env,
        clock: fakeClock(),
        spawn: recordingSpawn().spawn,
      }
    )
    expect(resumed.code).toBe(0)
    expect(resumed.report.credential.source).toBe('browser')
    expect(read(root, '.env.local')).toBe(`BREW_API_KEY=${APP_KEY}\n`)
    expect(existsSync(pendingLoginPath(env))).toBe(false)
    expect(
      requests.some((request) => request.path === '/v1/app-emails/kit')
    ).toBe(true)
  })

  it('names the launcher in the resume command', async () => {
    const root = copyFixture('next-better-auth')
    useLoginServer()
    const result = await init(['--yes', '--json'], {
      cwd: root,
      env: configEnv({ BREW_CLI_INVOKED_AS: 'npx -y brew.new@0.18.0' }),
      clock: fakeClock(),
      spawn: recordingSpawn().spawn,
    })
    expect(result.code).toBe(3)
    expect(
      result.report.nextSteps.find((step) => step.id === 'resume-init')?.command
    ).toBe('npx -y brew.new@0.18.0 init --json --resume --yes')
  })
})

describe('init: projects it cannot set up as they are', () => {
  it('exits 2 at a monorepo root with several apps, listing them', async () => {
    const root = copyFixture('pnpm-turbo')
    const result = await init(['--yes', '--json'], {
      cwd: root,
      env: configEnv(),
    })
    expect(result.code).toBe(2)
    expectValidReport(result.report)
    expect(result.report.status).toBe('ambiguous_project')
    expect(result.report.project.candidates).toEqual([
      { name: 'api', dir: 'apps/api', framework: 'hono' },
      { name: 'web', dir: 'apps/web', framework: 'next' },
    ])
    expect(result.report.nextSteps.map((step) => step.command)).toEqual([
      'brew-cli init --json --app apps/api --yes',
      'brew-cli init --json --app apps/web --yes',
    ])
  })

  it('exits 2 without a package.json', async () => {
    const root = copyFixture('no-package-json')
    const result = await init(['--yes', '--json'], {
      cwd: root,
      env: configEnv(),
    })
    expect(result.code).toBe(2)
    expect(result.stdout + result.stderr).toContain('No app found')
  })

  it('exits 2 on an unknown --stack before any request', async () => {
    const root = copyFixture('next-better-auth')
    const result = await init(['--yes', '--json', '--stack', 'lucia'], {
      cwd: root,
      env: configEnv(),
    })
    expect(result.code).toBe(2)
  })
})

describe('init per stack', () => {
  it('Supabase (Lovable): writes the Send Email Hook, patches config.toml only on request, installs nothing', async () => {
    const root = copyFixture('vite-supabase-lovable')
    useBrewApi()
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    const spawn = recordingSpawn()
    const result = await init(['--yes', '--json', '--no-test-email'], {
      cwd: root,
      env: configEnv(),
      spawn: spawn.spawn,
    })
    expect(result.code).toBe(0)
    expect(spawn.calls).toEqual([])
    expect(read(root, 'supabase/functions/send-email/index.ts')).toContain(
      'createSupabaseSendEmailHook'
    )
    expect(existsSync(join(root, 'src/lib/brew.ts'))).toBe(false)
    expect(read(root, '.env.example')).toBe(
      'BREW_API_KEY=\nSEND_EMAIL_HOOK_SECRET=\n'
    )
    expect(result.report.patches).toMatchObject([
      { id: 'supabase-config-hook', status: 'pending' },
    ])
    expect(read(root, 'supabase/config.toml')).not.toContain('send_email')
    expect(result.report.nextSteps.map((step) => step.id)).toEqual(
      expect.arrayContaining(['deploy-supabase-hook', 'connect-supabase-hook'])
    )
    expect(result.report.project.builder).toBe('lovable')
  })

  it('Clerk: lifecycle helper only, and a note that Clerk keeps its auth emails', async () => {
    const root = copyFixture('react-router-clerk')
    useBrewApi()
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    const result = await init(['--yes', '--json', '--no-test-email'], {
      cwd: root,
      env: configEnv(),
      spawn: recordingSpawn().spawn,
    })
    expect(result.code).toBe(0)
    expect(read(root, 'app/lib/brew-auth.ts')).toContain('sendWelcomeEmail')
    expect(result.report.patches).toEqual([])
    expect(
      result.report.nextSteps.find((step) => step.id === 'connect-clerk')
    ).toMatchObject({
      actor: 'human',
      blocking: false,
    })
  })

  it('Workers: getBrew(env) and the Worker secret step', async () => {
    const root = copyFixture('hono-workers')
    useBrewApi()
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    const result = await init(['--yes', '--json', '--no-test-email'], {
      cwd: root,
      env: configEnv(),
      spawn: recordingSpawn().spawn,
    })
    expect(result.code).toBe(0)
    expect(read(root, 'src/lib/brew.ts')).toContain(
      'export function getBrew(env: { BREW_API_KEY?: string }): BrewClient'
    )
    expect(
      result.report.nextSteps.find((step) => step.id === 'worker-secret')
    ).toMatchObject({
      command: 'wrangler secret put BREW_API_KEY',
      blocking: true,
    })
  })

  it('a monorepo app installs into its workspace from the root', async () => {
    const root = copyFixture('pnpm-turbo')
    useBrewApi()
    writeFileSync(
      join(root, 'apps/web/.env.local'),
      `BREW_API_KEY=${APP_KEY}\n`
    )
    const spawn = recordingSpawn()
    const result = await init(
      ['--yes', '--json', '--app', 'apps/web', '--no-test-email'],
      {
        cwd: root,
        env: configEnv(),
        spawn: spawn.spawn,
      }
    )
    expect(result.code).toBe(0)
    expect(spawn.calls).toEqual([
      {
        command: 'pnpm',
        args: ['add', '--filter', 'web', '@brew.new/sdk@^13.2.0'],
        cwd: root,
      },
    ])
    expect(existsSync(join(root, 'apps/web/lib/brew.js'))).toBe(true)
    expect(existsSync(join(root, 'apps/web/brew.json'))).toBe(true)
  })
})
