import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { pendingLoginPath } from '../../src/lib/auth-flow/pending'
import { readConfig } from '../../src/lib/config-store'
import type { InitReport } from '../../src/lib/init/report'
import { validateBrewState } from '../../src/lib/project/state'
import type { SpawnFn } from '../../src/lib/types'
import { contractHandler } from '../helpers/contract-artifacts'
import { copyFixture, tempProject } from '../helpers/fixtures'
import { loadSchema, validateSchema } from '../helpers/json-schema'
import {
  APP_KEY,
  APPROVER_EMAIL,
  BRAND,
  CLI_KEY,
  fakeClock,
  SESSION_ID,
  T0,
  USER_CODE,
  useLoginServer,
} from '../helpers/login-server'
import { server } from '../helpers/msw-server'
import {
  type RunCliOptions,
  type RunCliResult,
  runCli,
} from '../helpers/run-cli'

const API = 'https://brew.new/api'
const EXPLICIT_KEY = 'brew_explicit0123456789abcdefghijklmno'
const SECRETS = [APP_KEY, CLI_KEY, EXPLICIT_KEY]
const REPORT_SCHEMA = loadSchema('init-report.json')

const KIT_KEYS = [
  'auth.verify-email',
  'auth.password-reset',
  'auth.magic-link',
  'lifecycle.welcome',
]

type Recorded = {
  readonly method: string
  readonly path: string
  readonly body: unknown
  readonly idempotencyKey: string | null
  readonly brandId: string | null
  readonly authorization: string | null
}

function titleOf(key: string): string {
  return key
    .split(/[.-]/)
    .slice(1)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** The kit's trigger rows, as `GET /v1/automations/triggers` lists them. */
function kitTriggerRows() {
  return KIT_KEYS.map((key, index) => ({
    triggerEventId: `tri_${index}`,
    key,
    title: titleOf(key),
    provider: 'brew_api',
    payloadSchema: {
      type: 'object',
      fields: [
        { key: 'email', type: 'string', required: true },
        { key: 'appName', type: 'string', required: false },
        { key: 'userName', type: 'string', required: false },
        ...(key.startsWith('auth.')
          ? [
              { key: 'confirmationUrl', type: 'string', required: false },
              { key: 'otp', type: 'string', required: false },
            ]
          : []),
      ],
    },
    createdAt: '2026-10-13T12:00:00.000Z',
    updatedAt: '2026-10-13T12:00:00.000Z',
  }))
}

/** Brew's v1 API for init: brand, domains, kit, triggers, the by-key fire. */
function useBrewApi(
  options: {
    readonly domains?: ReadonlyArray<Record<string, unknown>>
    readonly failKeys?: readonly string[]
    /** A kit key's refusal, by key (beats `failKeys`' INTERNAL_ERROR). */
    readonly refusals?: Readonly<
      Record<string, { readonly code: string; readonly message: string }>
    >
    /** `warnings` on the `POST /v1/domains` row. */
    readonly addWarnings?: ReadonlyArray<Record<string, unknown>>
    /** Kit keys someone unpublished in Brew, which the kit leaves off. */
    readonly unpublished?: readonly string[]
  } = {}
): Recorded[] {
  const requests: Recorded[] = []
  const record = async (request: Request): Promise<unknown> => {
    const text = await request.text()
    const body = text === '' ? undefined : (JSON.parse(text) as unknown)
    requests.push({
      method: request.method,
      path: new URL(request.url).pathname.replace(/^\/api/, ''),
      body,
      idempotencyKey: request.headers.get('idempotency-key'),
      brandId: request.headers.get('x-brand-id'),
      authorization: request.headers.get('authorization'),
    })
    return body
  }
  server.use(
    contractHandler(API, kitTriggerRows),
    http.get(`${API}/v1/brand`, async ({ request }) => {
      await record(request)
      return HttpResponse.json({
        brandId: BRAND.brandId,
        domain: 'acme.com',
        status: 'completed',
        ready: true,
        identity: { brandName: BRAND.name },
      })
    }),
    http.get(`${API}/v1/domains`, async ({ request }) => {
      await record(request)
      return HttpResponse.json({
        data: options.domains ?? [],
        pagination: { limit: 100, cursor: null, hasMore: false },
      })
    }),
    http.post(`${API}/v1/domains`, async ({ request }) => {
      const body = (await record(request)) as { name: string }
      return HttpResponse.json(
        {
          domainId: 'dom_new',
          domainUrl: 'https://brew.new/domains/dom_new',
          name: body.name,
          region: 'us-east-1',
          status: 'not_started',
          sendingEnabled: false,
          sendable: false,
          sendingPurpose: 'transactional',
          records: [
            {
              record: 'DKIM',
              name: `brew._domainkey.${body.name}`,
              type: 'TXT',
              ttl: 'Auto',
              status: 'not_started',
              value: 'p=MIGf…',
            },
          ],
          createdAt: '2026-10-13T12:00:00.000Z',
          updatedAt: '2026-10-13T12:00:00.000Z',
          ...(options.addWarnings === undefined
            ? {}
            : { warnings: options.addWarnings }),
        },
        { status: 201 }
      )
    }),
    http.post(`${API}/v1/app-emails/kit`, async ({ request }) => {
      await record(request)
      return HttpResponse.json({
        results: KIT_KEYS.map((key, index) =>
          options.refusals?.[key] !== undefined
            ? { triggerKey: key, ok: false, error: options.refusals[key] }
            : options.failKeys?.includes(key)
              ? {
                  triggerKey: key,
                  ok: false,
                  error: { code: 'INTERNAL_ERROR', message: 'Import failed.' },
                }
              : {
                  ok: true,
                  triggerKey: key,
                  triggerEventId: `tri_${index}`,
                  emailId: `eml_${index}`,
                  emailVersionId: `emv_${index}`,
                  automationId: `aut_${index}`,
                  published: !options.unpublished?.includes(key),
                  created: { trigger: true, email: true, automation: true },
                  sender: {
                    mode: 'sandbox',
                    from: 'acme@email.brew.new',
                    sandbox: { dailyLimit: 50, remainingToday: 50 },
                  },
                  payloadSchema: { type: 'object', fields: [] },
                  fireExample: {
                    method: 'POST',
                    path: `/v1/automations/triggers/by-key/${key}/fire`,
                    examplePayload: { email: 'jane@example.com' },
                    curl: 'curl …',
                    sdk: `await brew.send('${key}', { email })`,
                  },
                  warnings: options.unpublished?.includes(key)
                    ? [{ code: 'APP_EMAIL_NOT_PUBLISHED', message: 'Off.' }]
                    : [],
                }
        ),
        stack: {
          provider: 'better-auth',
          authDelivery: 'code',
          note: 'Wire the callbacks into betterAuth.',
          keys: KIT_KEYS.filter((key) => key.startsWith('auth.')),
          snippets: [],
        },
      })
    }),
    http.get(`${API}/v1/automations/triggers`, async ({ request }) => {
      await record(request)
      return HttpResponse.json({
        data: kitTriggerRows(),
        pagination: { limit: 100, cursor: null, hasMore: false },
      })
    }),
    http.post(
      `${API}/v1/automations/triggers/by-key/:key/fire`,
      async ({ request, params }) => {
        await record(request)
        return HttpResponse.json(
          {
            triggerInstanceId: 'tin_1',
            triggerEventId: 'tri_3',
            triggerKey: String(params.key),
            status: 'triggered',
            automationRunIds: ['run_1'],
            notStarted: [],
            publishedAutomations: [{ automationId: 'aut_3' }],
            counts: { automations: 1, skipped: 0 },
            warnings: [],
            receivedAt: '2026-10-13T12:00:00.000Z',
          },
          { status: 202 }
        )
      }
    )
  )
  return requests
}

type SpawnCall = {
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string | undefined
}

/** git is "not a repository" (the .gitignore fallback); installs succeed. */
function recordingSpawn(): {
  readonly calls: SpawnCall[]
  readonly spawn: SpawnFn
} {
  const calls: SpawnCall[] = []
  return {
    calls,
    spawn: async (command, args, options) => {
      if (command === 'git') {
        return { code: 128, stdout: '', stderr: 'fatal: not a git repository' }
      }
      calls.push({ command, args, cwd: options?.cwd })
      return { code: 0, stdout: '', stderr: '' }
    },
  }
}

function configEnv(
  extra: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-init-')),
    ...extra,
  }
}

async function init(
  argv: readonly string[],
  options: RunCliOptions & { readonly cwd: string }
): Promise<RunCliResult & { readonly report: InitReport }> {
  const result = await runCli(['init', ...argv], options)
  // Secret canary: no key ever reaches the terminal, in any mode.
  for (const secret of SECRETS) {
    expect(result.stdout).not.toContain(secret)
    expect(result.stderr).not.toContain(secret)
  }
  return { ...result, report: result.json as InitReport }
}

function expectValidReport(report: InitReport): void {
  expect(validateSchema(REPORT_SCHEMA, report)).toEqual([])
}

function read(root: string, path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

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
    ).toBe("npm install '@brew.new/sdk@^13.6.0'")
  })

  it.each([
    ['^12.3.0', "npm install '@brew.new/sdk@^13.6.0'"],
    ['^13.3.0', "npm install '@brew.new/sdk@^13.6.0'"],
    ['^13.5.0', "npm install '@brew.new/sdk@^13.6.0'"],
    ['^13.6.0', '@brew.new/sdk ^13.6.0 already declared'],
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
    // The SDK's own key: a re-run must reach the kit, not its replay.
    expect(kit?.idempotencyKey).not.toContain('init:')
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
        args: ['install', '@brew.new/sdk@^13.6.0'],
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
      command: `brew-cli init --apply-patches=better-auth-config@${report.patches[0]?.baseSha256?.slice(0, 12)} --json --yes`,
    })
    expect(report.domain).toMatchObject({ mode: 'sandbox' })
    expect(report.nextSteps.map((step) => step.id)).toContain('verify-domain')
    expect(report.emails.map((email) => email.key)).toEqual(KIT_KEYS)

    // Re-run: nothing changes, no sign-in, the test email replays.
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
    const keyOf = (list: Recorded[], path: string) =>
      list.find((request) => request.path.endsWith(path))?.idempotencyKey
    expect(keyOf(again, '/fire')).toBe(keyOf(requests, '/fire'))
    expect(keyOf(again, '/kit')).not.toBe(keyOf(requests, '/kit'))
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
      command: "npm install '@brew.new/sdk@^13.6.0'",
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

  it('a re-run reaches the kit again to finish the keys that failed', async () => {
    const root = copyFixture('express-resend')
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    const options = {
      cwd: root,
      env: configEnv(),
      spawn: recordingSpawn().spawn,
    }
    const first = useBrewApi({ failKeys: ['lifecycle.welcome'] })
    const created = await init(['--yes', '--json', '--no-test-email'], options)
    expect(created.report.nextSteps.map((step) => step.id)).toContain(
      'rerun-init'
    )
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
    const rerun = await init(['--yes', '--json', '--no-test-email'], options)
    expect(rerun.report.emails.every((email) => email.ok)).toBe(true)
    // A new key: the same one would replay the failed response for 24 hours.
    const kitKey = (list: Recorded[]) =>
      list.find((request) => request.path === '/v1/app-emails/kit')
        ?.idempotencyKey
    expect(kitKey(second)).not.toBe(kitKey(first))
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
      'npm:@brew.new/sdk@^13.6.0/supabase'
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
    expect(result.report.domain.records).toEqual([])
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

  it('names a kit key unpublished in Brew instead of counting it published', async () => {
    const root = copyFixture('express-resend')
    useBrewApi({ unpublished: ['lifecycle.welcome'] })
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    const result = await init(['--yes', '--json', '--no-test-email'], {
      cwd: root,
      env: configEnv(),
      spawn: recordingSpawn().spawn,
    })
    expect(result.code).toBe(0)
    expectValidReport(result.report)
    expect(result.report.steps.find((step) => step.id === 'kit')).toEqual({
      id: 'kit',
      status: 'done',
      detail: '3 app emails published; not published: lifecycle.welcome',
    })
    expect(
      result.report.nextSteps.find((step) => step.id === 'publish-app-emails')
    ).toEqual({
      id: 'publish-app-emails',
      actor: 'human',
      kind: 'review',
      title:
        'Not published: lifecycle.welcome. Publish it in Brew, or run `brew-cli app-emails upsert <key> --publish --yes`',
      blocking: false,
    })
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
        command: 'brew-cli init --no-test-email --resume --json --yes',
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
        // One poll interval later: a resume never polls before the server allows.
        clock: fakeClock(T0 + 2000),
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
    ).toBe('npx -y brew.new@0.18.0 init --resume --json --yes')
  })

  it('a sign-in that saves the CLI key drops an older one still pending', async () => {
    const root = copyFixture('next-better-auth')
    useLoginServer({ steps: ['approved'] })
    useBrewApi()
    const env = configEnv()
    const options = {
      cwd: root,
      env,
      clock: fakeClock(),
      spawn: recordingSpawn().spawn,
    }
    const argv = ['--yes', '--json', '--no-test-email']
    expect((await init(argv, options)).code).toBe(3)
    const signedIn = await init(argv, { ...options, ttyIn: true })
    expect(signedIn.code).toBe(0)
    expect(readConfig(env).apiKey).toBe(CLI_KEY)
    expect(existsSync(pendingLoginPath(env))).toBe(false)
  })

  it('a CLI key it cannot save still leaves the app key, and says to revoke it', async () => {
    const root = copyFixture('next-better-auth')
    useLoginServer({ steps: ['approved'] })
    useBrewApi()
    const notADirectory = join(tempProject(), 'file')
    writeFileSync(notADirectory, '')
    const result = await init(['--yes', '--json', '--no-test-email'], {
      cwd: root,
      env: { BREW_CLI_CONFIG_DIR: join(notADirectory, 'brew-cli') },
      ttyIn: true,
      clock: fakeClock(),
      spawn: recordingSpawn().spawn,
    })
    expect(result.code).toBe(0)
    expect(read(root, '.env.local')).toBe(`BREW_API_KEY=${APP_KEY}\n`)
    expect(result.report.nextSteps).toContainEqual(
      expect.objectContaining({ id: 'save-cli-key', command: 'brew-cli login' })
    )
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
      'brew-cli init --app=apps/api --json --yes',
      'brew-cli init --app=apps/web --json --yes',
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
        args: ['add', '--filter', 'web', '@brew.new/sdk@^13.6.0'],
        cwd: root,
      },
    ])
    expect(existsSync(join(root, 'apps/web/lib/brew.js'))).toBe(true)
    expect(existsSync(join(root, 'apps/web/brew.json'))).toBe(true)
  })

  it('an app at a pnpm workspace root installs with --workspace-root', async () => {
    const root = tempProject()
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'acme', dependencies: { next: '15.0.0' } })
    )
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - pkgs/*\n')
    writeFileSync(join(root, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n")
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    useBrewApi()
    const spawn = recordingSpawn()
    const result = await init(['--yes', '--json', '--no-test-email'], {
      cwd: root,
      env: configEnv(),
      spawn: spawn.spawn,
    })
    expect(result.code).toBe(0)
    expect(spawn.calls).toEqual([
      {
        command: 'pnpm',
        args: ['add', '--workspace-root', '@brew.new/sdk@^13.6.0'],
        cwd: root,
      },
    ])
  })
})

describe('init: what a run must not get wrong', () => {
  /** A project with an app key in .env.local: no sign-in. */
  function keyed(fixture: string): string {
    const root = copyFixture(fixture)
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    return root
  }

  it('--stack wires the auth library it names, over detection', async () => {
    const root = keyed('express-resend')
    useBrewApi()
    const result = await init(
      ['--yes', '--json', '--no-test-email', '--stack', 'better-auth'],
      { cwd: root, env: configEnv(), spawn: recordingSpawn().spawn }
    )
    expectValidReport(result.report)
    expect(result.report.project.auth).toBe('better-auth')
    expect(read(root, 'src/lib/brew-auth.ts')).toContain(
      'export const brewEmails = brewAuthEmails({'
    )
    expect(result.report.patches.map((patch) => patch.id)).toEqual([
      'better-auth-config',
    ])
  })

  it.each([
    ['vite-supabase-lovable', 'supabase-config-hook'],
    ['next-app-authjs-v5', 'authjs-config'],
  ])(
    '--sets lifecycle leaves the auth emails of %s to it',
    async (fixture, patchId) => {
      const root = copyFixture(fixture)
      useBrewApi()
      const result = await init(
        ['--dry-run', '--json', '--sets', 'lifecycle'],
        { cwd: root, env: configEnv({ BREW_API_KEY: EXPLICIT_KEY }) }
      )
      expectValidReport(result.report)
      expect(result.report.patches.map((patch) => patch.id)).not.toContain(
        patchId
      )
      expect(result.report.files.map((file) => file.path)).not.toContain(
        'supabase/functions/send-email/index.ts'
      )
      expect(result.report.nextSteps.map((step) => step.id)).not.toContain(
        'deploy-supabase-hook'
      )
    }
  )

  it('--sets lifecycle after the auth set keeps the Auth.js provider the app imports', async () => {
    const root = keyed('next-app-authjs-v5')
    useBrewApi()
    const options = {
      cwd: root,
      env: configEnv(),
      spawn: recordingSpawn().spawn,
    }
    const first = await init(['--yes', '--json', '--no-test-email'], options)
    const helper = first.report.files.find((file) => file.role === 'auth')
    expect(read(root, helper?.path ?? '')).toContain('brewEmailProvider')
    const rerun = await init(
      ['--yes', '--json', '--no-test-email', '--sets', 'lifecycle'],
      options
    )
    expect(
      rerun.report.files.find((file) => file.path === helper?.path)?.action
    ).toBe('unchanged')
  })

  it('a generated file or brew.json it may not write fails the run, and no patch applies', async () => {
    const root = keyed('next-better-auth')
    const outside = tempProject()
    symlinkSync(join(outside, 'brew-auth.ts'), join(root, 'lib/brew-auth.ts'))
    symlinkSync(join(outside, 'brew.json'), join(root, 'brew.json'))
    const argv = ['--yes', '--json', '--no-test-email', '--no-install']
    const options = {
      cwd: root,
      env: configEnv(),
      spawn: recordingSpawn().spawn,
    }
    useBrewApi()
    const first = await init(argv, options)
    expect(first.code).toBe(1)
    expectValidReport(first.report)
    expect(
      first.report.steps.filter((step) => step.status === 'failed')
    ).toMatchObject([
      { id: 'files', detail: expect.stringContaining('lib/brew-auth.ts') },
      { id: 'state', detail: expect.stringContaining('brew.json') },
    ])
    const before = read(root, 'lib/auth.ts')
    const pin = `better-auth-config@${first.report.patches[0]?.baseSha256?.slice(0, 12)}`
    useBrewApi()
    const applied = await init([...argv, '--apply-patches', pin], options)
    expect(applied.report.patches[0]?.status).toBe('pending')
    expect(read(root, 'lib/auth.ts')).toBe(before)
    expect(existsSync(join(outside, 'brew-auth.ts'))).toBe(false)
  })

  it.each([
    [
      'a kit key failed',
      () => {},
      { failKeys: ['auth.verify-email'] },
      'pending',
    ],
    [
      'a kit key is unpublished in Brew',
      () => {},
      { unpublished: ['auth.password-reset'] },
      'pending',
    ],
    [
      'the helper keeps your edits',
      (root: string) =>
        writeFileSync(
          join(root, 'lib/brew-auth.ts'),
          `${read(root, 'lib/brew-auth.ts')}// mine\n`
        ),
      {},
      'manual',
    ],
    [
      '.env.local cannot be written (the app key may be missing)',
      (root: string) => {
        const outside = join(tempProject(), '.env.local')
        writeFileSync(outside, read(root, '.env.local'))
        rmSync(join(root, '.env.local'))
        symlinkSync(outside, join(root, '.env.local'))
      },
      {},
      'pending',
    ],
  ])('no patch applies when %s', async (_case, edit, api, status) => {
    const root = keyed('next-better-auth')
    const argv = ['--yes', '--json', '--no-test-email', '--no-install']
    const options = {
      cwd: root,
      env: configEnv(),
      spawn: recordingSpawn().spawn,
    }
    useBrewApi()
    const first = await init(argv, options)
    const pin = `better-auth-config@${first.report.patches[0]?.baseSha256?.slice(0, 12)}`
    const before = read(root, 'lib/auth.ts')
    edit(root)
    useBrewApi(api)
    const result = await init([...argv, '--apply-patches', pin], options)
    expect(result.report.patches[0]?.status).toBe(status)
    expect(read(root, 'lib/auth.ts')).toBe(before)
    // The terminal shows the change to make, pending or by hand.
    const human = await init(
      argv.filter((arg) => arg !== '--json'),
      { ...options, ttyOut: true }
    )
    expect(human.stdout).toContain(result.report.patches[0]?.diff?.trimEnd())
  })

  it('makes publishing a key left off blocking while a patch waits for it', async () => {
    const root = keyed('next-better-auth')
    useBrewApi({ unpublished: ['auth.password-reset'] })
    const result = await init(
      ['--yes', '--json', '--no-test-email', '--no-install'],
      { cwd: root, env: configEnv(), spawn: recordingSpawn().spawn }
    )
    expect(
      result.report.nextSteps.find((step) => step.id === 'publish-app-emails')
    ).toMatchObject({ blocking: true })
  })

  it('asks to move an SDK declared only in devDependencies', async () => {
    const root = keyed('express-resend')
    const pkg = JSON.parse(read(root, 'package.json'))
    pkg.devDependencies = { '@brew.new/sdk': '^13.6.0' }
    writeFileSync(join(root, 'package.json'), JSON.stringify(pkg))
    useBrewApi()
    const result = await init(['--yes', '--json', '--no-test-email'], {
      cwd: root,
      env: configEnv(),
      spawn: recordingSpawn().spawn,
    })
    expect(
      result.report.nextSteps.find((step) => step.id === 'sdk-in-dependencies')
    ).toMatchObject({ path: 'package.json', blocking: false })
  })

  it('on Windows, hands the SDK install to the agent instead of failing', async () => {
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'win32' })
    try {
      const root = keyed('express-resend')
      useBrewApi()
      const spawn = recordingSpawn()
      const result = await init(
        ['--yes', '--json', '--no-test-email', '--no-mcp'],
        { cwd: root, env: configEnv(), spawn: spawn.spawn }
      )
      expect(spawn.calls).toEqual([])
      expect(
        result.report.steps.find((step) => step.id === 'install')
      ).toMatchObject({ status: 'skipped' })
      expect(
        result.report.nextSteps.find((step) => step.id === 'install-sdk')
      ).toMatchObject({
        command: "npm install '@brew.new/sdk@^13.6.0'",
        blocking: true,
      })
    } finally {
      if (platform !== undefined) {
        Object.defineProperty(process, 'platform', platform)
      }
    }
  })

  it('retries a test email that did not go out as the same account, quoted', async () => {
    const root = keyed('express-resend')
    useBrewApi()
    server.use(
      http.post(`${API}/v1/automations/triggers/by-key/:key/fire`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'INVALID_PAYLOAD',
              type: 'invalid_request_error',
              message: 'The payload does not match the contract.',
            },
          },
          { status: 400 }
        )
      )
    )
    const result = await init(
      ['--yes', '--json', '--no-install', '--test-to', "o'connor@acme.com"],
      {
        cwd: root,
        env: configEnv(),
        spawn: recordingSpawn().spawn,
      }
    )
    expect(result.report.testEmail.status).toBe('failed')
    expect(
      result.report.nextSteps.find((step) => step.id === 'send-test-email')
        ?.command
    ).toBe(
      "brew-cli init '--test-to=o'\\''connor@acme.com' --no-install --json --yes"
    )
  })

  it('finds a --domain on a later page instead of adding it again', async () => {
    const root = keyed('express-resend')
    const requests = useBrewApi()
    server.use(
      http.get(`${API}/v1/domains`, ({ request }) => {
        const later = new URL(request.url).searchParams.get('cursor') !== null
        return HttpResponse.json({
          data: later
            ? [
                {
                  domainId: 'dom_later',
                  domainUrl: 'https://brew.new/domains/dom_later',
                  name: 'mail.acme.com',
                  region: 'us-east-1',
                  status: 'verified',
                  sendingEnabled: true,
                  sendable: true,
                  sendingPurpose: 'transactional',
                  records: [],
                  createdAt: '2026-10-13T12:00:00.000Z',
                  updatedAt: '2026-10-13T12:00:00.000Z',
                },
              ]
            : [],
          pagination: {
            limit: 100,
            cursor: later ? null : 'page-2',
            hasMore: !later,
          },
        })
      })
    )
    const result = await init(
      ['--yes', '--json', '--no-test-email', '--domain', 'mail.acme.com'],
      { cwd: root, env: configEnv(), spawn: recordingSpawn().spawn }
    )
    expect(result.report.domain).toMatchObject({
      domainId: 'dom_later',
      mode: 'domain',
      added: false,
    })
    expect(
      requests.filter((request) => request.path === '/v1/domains')
    ).toEqual([])
  })

  it('tells how to finish an editor whose config init only reports on', async () => {
    const root = keyed('express-resend')
    mkdirSync(join(root, '.codex'))
    useBrewApi()
    const result = await init(['--yes', '--json', '--no-test-email'], {
      cwd: root,
      env: configEnv(),
      spawn: recordingSpawn().spawn,
    })
    expect(result.report.mcp).toMatchObject([
      { client: 'codex', action: 'manual' },
    ])
    expect(
      result.report.nextSteps.find((step) => step.id === 'mcp-install-codex')
    ).toMatchObject({
      command: 'brew-cli mcp install --client codex',
      blocking: false,
    })
  })
})
