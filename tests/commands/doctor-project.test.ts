import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import type { ProjectDoctorReport } from '../../src/lib/doctor/project'
import { sha256Hex } from '../../src/lib/project/fs-writer'
import { tempProject } from '../helpers/fixtures'
import { server } from '../helpers/msw-server'
import {
  type RunCliOptions,
  type RunCliResult,
  runCli,
} from '../helpers/run-cli'

const API = 'https://brew.new/api'
const APP_KEY = 'brew_appkey0123456789abcdefghijklmnopqrs'
const BRAND_ID = 'brand_acme'
const CLIENT_FILE = "import { createBrewClient } from '@brew.new/sdk'\n"

type Seen = { readonly path: string; readonly brandId: string | null }

/** A project exactly as init leaves it. */
function healthyProject(
  options: { readonly auth?: string; readonly providerConfig?: unknown } = {}
): string {
  const root = tempProject('brew-doctor-')
  mkdirSync(join(root, 'lib'))
  writeFileSync(join(root, 'lib/brew.ts'), CLIENT_FILE)
  writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
  writeFileSync(join(root, '.gitignore'), 'node_modules\n.env.local\n')
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'app',
      dependencies: { '@brew.new/sdk': '^13.6.0' },
    })
  )
  mkdirSync(join(root, 'node_modules/@brew.new/sdk'), { recursive: true })
  writeFileSync(
    join(root, 'node_modules/@brew.new/sdk/package.json'),
    JSON.stringify({ name: '@brew.new/sdk', version: '13.6.1' })
  )
  writeFileSync(
    join(root, 'brew.json'),
    `${JSON.stringify(
      {
        version: 1,
        projectId: '6f1c1d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f',
        brandId: BRAND_ID,
        framework: 'next-app',
        auth: options.auth ?? 'better-auth',
        emails: {
          'auth.verify-email': {
            triggerEventId: 'tri_0',
            automationId: 'aut_0',
          },
          'lifecycle.welcome': {
            triggerEventId: 'tri_1',
            automationId: 'aut_1',
          },
        },
        files: {
          'lib/brew.ts': {
            sha256: sha256Hex(CLIENT_FILE),
            generator: 'init@0.21.0:lib/brew.ts',
          },
        },
        ...(options.providerConfig === undefined
          ? {}
          : { providerConfig: options.providerConfig }),
      },
      null,
      2
    )}\n`
  )
  return root
}

function useProjectApi(
  options: {
    readonly brandId?: string
    readonly brandStatus?: number
    readonly appEmails?: ReadonlyArray<Record<string, unknown>>
    readonly verifiedDomain?: boolean
    readonly connection?: Record<string, unknown> | null
  } = {}
): Seen[] {
  const seen: Seen[] = []
  const note = (request: Request) =>
    seen.push({
      path: new URL(request.url).pathname.replace(/^\/api/, ''),
      brandId: request.headers.get('x-brand-id'),
    })
  server.use(
    http.get(`${API}/v1/brand`, ({ request }) => {
      note(request)
      if (options.brandStatus !== undefined) {
        return HttpResponse.json(
          {
            error: {
              code: 'INVALID_API_KEY',
              type: 'authentication_error',
              message: 'Invalid API key.',
            },
          },
          { status: options.brandStatus }
        )
      }
      return HttpResponse.json({
        brandId: options.brandId ?? BRAND_ID,
        domain: 'acme.com',
        status: 'completed',
        ready: true,
        identity: { brandName: 'Acme' },
      })
    }),
    http.get(`${API}/v1/app-emails`, ({ request }) => {
      note(request)
      return HttpResponse.json({
        data: options.appEmails ?? [
          {
            triggerKey: 'auth.verify-email',
            triggerEventId: 'tri_0',
            published: true,
          },
          {
            triggerKey: 'lifecycle.welcome',
            triggerEventId: 'tri_1',
            published: true,
          },
        ],
        pagination: { limit: 100, cursor: null, hasMore: false },
      })
    }),
    http.get(`${API}/v1/domains`, ({ request }) => {
      note(request)
      return HttpResponse.json({
        data:
          options.verifiedDomain === true
            ? [{ name: 'mail.acme.com', status: 'verified', sendable: true }]
            : [{ name: 'mail.acme.com', status: 'pending', sendable: false }],
        pagination: { limit: 100, cursor: null, hasMore: false },
      })
    }),
    http.get(`${API}/v1/integrations/:provider/connection`, ({ request }) => {
      note(request)
      if (options.connection === undefined || options.connection === null) {
        return HttpResponse.json(
          {
            error: {
              code: 'NOT_FOUND',
              type: 'not_found_error',
              message: 'Not connected.',
            },
          },
          { status: 404 }
        )
      }
      return HttpResponse.json(options.connection)
    })
  )
  return seen
}

async function doctor(
  root: string,
  options: RunCliOptions = {}
): Promise<RunCliResult & { readonly report: ProjectDoctorReport }> {
  const result = await runCli(['doctor', '--project', '--json'], {
    cwd: root,
    ...options,
    env: {
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-doctor-config-')),
      ...options.env,
    },
  })
  expect(result.stdout).not.toContain(APP_KEY)
  expect(result.stderr).not.toContain(APP_KEY)
  return { ...result, report: result.json as ProjectDoctorReport }
}

function statusOf(report: ProjectDoctorReport, id: string): readonly string[] {
  return report.checks
    .filter((check) => check.id === id)
    .map((check) => check.status)
}

describe('doctor --project', () => {
  it('a project as init left it: every check ok, the app key from .env.local (no X-Brand-Id), exit 0', async () => {
    const root = healthyProject()
    const seen = useProjectApi({ verifiedDomain: true })
    const result = await doctor(root)
    expect(result.code).toBe(0)
    expect(result.report.ok).toBe(true)
    expect(
      Object.fromEntries(
        result.report.checks.map((check) => [check.id, check.status])
      )
    ).toEqual({
      state: 'ok',
      files: 'ok',
      env: 'ok',
      'env-exposure': 'ok',
      gitignore: 'ok',
      sdk: 'ok',
      auth: 'ok',
      'app-emails': 'ok',
      domain: 'ok',
      provider: 'skipped',
    })
    expect(seen.every((request) => request.brandId === null)).toBe(true)
    expect(result.report.apiKey).toMatch(/^brew_/)
  })

  it('fails on a deleted managed file, warns on an edited one', async () => {
    const root = healthyProject()
    useProjectApi({ verifiedDomain: true })
    writeFileSync(join(root, 'lib/brew.ts'), `${CLIENT_FILE}// mine\n`)
    const edited = await doctor(root)
    expect(edited.code).toBe(0)
    expect(statusOf(edited.report, 'files')).toEqual(['warn'])
    rmSync(join(root, 'lib/brew.ts'))
    const missing = await doctor(root)
    expect(missing.code).toBe(1)
    expect(
      missing.report.checks.find((check) => check.id === 'files')
    ).toMatchObject({
      status: 'fail',
      items: ['lib/brew.ts'],
    })
  })

  it('fails when the key sits under a browser-exposed name, without printing its value', async () => {
    const root = healthyProject()
    useProjectApi({ verifiedDomain: true })
    writeFileSync(
      join(root, '.env'),
      `NEXT_PUBLIC_BREW_API_KEY=${APP_KEY}\nVITE_TITLE=Acme\n`
    )
    const result = await doctor(root)
    expect(result.code).toBe(1)
    expect(
      result.report.checks.find((check) => check.id === 'env-exposure')
    ).toMatchObject({
      status: 'fail',
      items: ['.env: NEXT_PUBLIC_BREW_API_KEY'],
    })
  })

  it('fails when .env.local is not git-ignored, or the key is missing', async () => {
    const root = healthyProject()
    useProjectApi({ verifiedDomain: true })
    writeFileSync(join(root, '.gitignore'), 'node_modules\n')
    writeFileSync(join(root, '.env.local'), 'OTHER=1\n')
    const result = await doctor(root)
    expect(result.code).toBe(1)
    expect(statusOf(result.report, 'gitignore')).toEqual(['fail'])
    expect(statusOf(result.report, 'env')).toEqual(['fail'])
    expect(statusOf(result.report, 'auth')).toEqual(['skipped'])
  })

  it('checks the SDK: declared too old fails, declared but not installed warns', async () => {
    const root = healthyProject()
    useProjectApi({ verifiedDomain: true })
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ dependencies: { '@brew.new/sdk': '^13.3.0' } })
    )
    const old = await doctor(root)
    expect(old.code).toBe(1)
    expect(
      old.report.checks.find((check) => check.id === 'sdk')?.detail
    ).toContain('^13.3.0 is older than the ^13.6.0')
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ dependencies: { '@brew.new/sdk': '^13.6.0' } })
    )
    rmSync(join(root, 'node_modules'), { recursive: true })
    const notInstalled = await doctor(root)
    expect(statusOf(notInstalled.report, 'sdk')).toEqual(['warn'])
  })

  it('fails when a key in brew.json has no app email in the brand, or the key belongs to another brand', async () => {
    const root = healthyProject()
    useProjectApi({
      verifiedDomain: true,
      appEmails: [
        {
          triggerKey: 'lifecycle.welcome',
          triggerEventId: 'tri_1',
          published: true,
        },
      ],
    })
    const result = await doctor(root)
    expect(result.code).toBe(1)
    expect(
      result.report.checks.find((check) => check.id === 'app-emails')
    ).toMatchObject({
      status: 'fail',
      items: ['auth.verify-email'],
    })
    useProjectApi({ brandId: 'brand_other', verifiedDomain: true })
    const other = await doctor(root)
    expect(statusOf(other.report, 'auth')).toEqual(['fail'])
  })

  it('a rejected key fails auth and skips the brand checks (exit 1)', async () => {
    const root = healthyProject()
    useProjectApi({ brandStatus: 401 })
    const result = await doctor(root)
    expect(result.code).toBe(1)
    expect(statusOf(result.report, 'auth')).toEqual(['fail'])
    expect(statusOf(result.report, 'app-emails')).toEqual(['skipped'])
  })

  it('warns in the sandbox and on a hook that is not active yet; ok once active', async () => {
    const root = healthyProject({
      auth: 'supabase',
      providerConfig: {
        supabase_auth: {
          projectRef: 'abcdefghijklmnopqrst',
          savedAt: '2026-10-17T00:00:00.000Z',
          previous: {
            hook_send_email_enabled: false,
            hook_send_email_uri: null,
          },
        },
      },
    })
    const connection = {
      provider: 'supabase_auth',
      connectionId: 'conn_1',
      webhookUrl:
        'https://brew.new/api/integrations/supabase_auth/webhook/conn_1',
      status: 'pending_verification',
    }
    const seen = useProjectApi({ connection })
    const pending = await doctor(root)
    expect(pending.code).toBe(0)
    expect(statusOf(pending.report, 'domain')).toEqual(['warn'])
    expect(statusOf(pending.report, 'provider')).toEqual(['warn'])
    expect(seen.map((request) => request.path)).toContain(
      '/v1/integrations/supabase_auth/connection'
    )
    useProjectApi({ connection: { ...connection, status: 'active' } })
    const active = await doctor(root)
    expect(statusOf(active.report, 'provider')).toEqual(['ok'])
    useProjectApi({ connection: null })
    const notConnected = await doctor(root)
    expect(statusOf(notConnected.report, 'provider')).toEqual(['warn'])
  })

  it('exits 2 outside a project with brew.json', async () => {
    const root = tempProject('brew-doctor-empty-')
    const result = await runCli(['doctor', '--project', '--json'], {
      cwd: root,
      env: {
        BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-doctor-config-')),
      },
    })
    expect(result.code).toBe(2)
    expect(result.stdout + result.stderr).toContain('No brew.json')
  })

  it('renders a human report', async () => {
    const root = healthyProject()
    useProjectApi()
    const result = await runCli(['doctor', '--project'], {
      cwd: root,
      ttyOut: true,
      env: {
        BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-doctor-config-')),
      },
    })
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('WARN  domain: no verified sending domain')
    expect(result.stdout).not.toContain(APP_KEY)
  })
})
