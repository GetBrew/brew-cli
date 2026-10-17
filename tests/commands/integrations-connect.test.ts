import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import {
  type RunCliOptions,
  type RunCliResult,
  runCli,
} from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const API = 'https://brew.new/api'
const SUPABASE_SECRET =
  'v1,whsec_dGhpc2lzYW5leGFtcGxlc2VjcmV0Zm9yYnJldzEyMzQ1Ng=='
const CLERK_SECRET = 'whsec_C2FVsBQIhrscChlQIMV+b5sSYspob7oD'
const SECRETS = [KEY, SUPABASE_SECRET, CLERK_SECRET, 'C2FVsBQIhrscChlQIMV']

async function cli(
  argv: readonly string[],
  options: RunCliOptions = {}
): Promise<RunCliResult> {
  const result = await runCli(argv, {
    ...options,
    env: {
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
      BREW_API_KEY: KEY,
      ...options.env,
    },
  })
  // Secret canary: a signing secret never reaches the terminal.
  for (const secret of SECRETS) {
    expect(result.stdout).not.toContain(secret)
    expect(result.stderr).not.toContain(secret)
  }
  return result
}

type Seen = {
  method: string
  path: string
  body: unknown
  idempotencyKey: string | null
}

function useConnectionApi(
  options: { readonly getStatus?: number; readonly putStatus?: number } = {}
): Seen[] {
  const seen: Seen[] = []
  const connection = (provider: string) => ({
    provider,
    connectionId: `conn_${provider}`,
    webhookUrl: `https://brew.new/api/integrations/${provider}/webhook/conn_${provider}`,
    status: 'pending_verification',
  })
  server.use(
    http.get(
      `${API}/v1/integrations/:provider/connection`,
      ({ request, params }) => {
        seen.push({
          method: 'GET',
          path: new URL(request.url).pathname,
          body: undefined,
          idempotencyKey: request.headers.get('idempotency-key'),
        })
        if (options.getStatus === 404) {
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
        return HttpResponse.json({
          ...connection(String(params.provider)),
          status: 'active',
        })
      }
    ),
    http.put(
      `${API}/v1/integrations/:provider/connection`,
      async ({ request, params }) => {
        seen.push({
          method: 'PUT',
          path: new URL(request.url).pathname,
          body: await request.json(),
          idempotencyKey: request.headers.get('idempotency-key'),
        })
        if (options.putStatus === 400) {
          // An API that echoes what it got must still not leak it.
          return HttpResponse.json(
            {
              error: {
                code: 'INVALID_REQUEST',
                type: 'invalid_request_error',
                message: 'The signing secret is not valid for this provider.',
              },
            },
            { status: 400 }
          )
        }
        return HttpResponse.json({
          ...connection(String(params.provider)),
          authEmails: [
            { triggerKey: 'auth.verify-email', ok: true },
            {
              triggerKey: 'auth.otp',
              ok: false,
              error: { code: 'INTERNAL_ERROR', message: 'Import failed.' },
            },
          ],
        })
      }
    )
  )
  return seen
}

describe('integrations connect', () => {
  it('connects supabase_auth with the secret from an env var and prints the webhook URL', async () => {
    const seen = useConnectionApi()
    const result = await cli(
      [
        'integrations',
        'connect',
        'supabase_auth',
        '--signing-secret-env',
        'HOOK_SECRET',
        '--project-url',
        'https://abcdefghijklmnopqrst.supabase.co',
        '--yes',
        '--json',
      ],
      { env: { HOOK_SECRET: SUPABASE_SECRET } }
    )
    expect(result.code).toBe(0)
    expect(seen).toEqual([
      {
        method: 'PUT',
        path: '/api/v1/integrations/supabase_auth/connection',
        body: {
          signingSecret: SUPABASE_SECRET,
          settings: { projectUrl: 'https://abcdefghijklmnopqrst.supabase.co' },
        },
        idempotencyKey: null,
      },
    ])
    expect(result.json).toMatchObject({
      provider: 'supabase_auth',
      connectionId: 'conn_supabase_auth',
      webhookUrl:
        'https://brew.new/api/integrations/supabase_auth/webhook/conn_supabase_auth',
      status: 'pending_verification',
    })
  })

  it('reads a Clerk secret from stdin; the human output names the URL, the failed key, and what to paste', async () => {
    const seen = useConnectionApi()
    const result = await cli(
      ['integrations', 'connect', 'clerk', '--signing-secret-stdin', '--yes'],
      { stdin: `${CLERK_SECRET}\n`, ttyOut: true }
    )
    expect(result.code).toBe(0)
    expect(seen[0]?.body).toEqual({ signingSecret: CLERK_SECRET })
    expect(result.stdout).toContain(
      'Webhook URL:   https://brew.new/api/integrations/clerk/webhook/conn_clerk'
    )
    expect(result.stdout).toContain('1 failed: auth.otp (INTERNAL_ERROR)')
    expect(result.stdout).toContain('Clerk Dashboard')
  })

  it('is destructive: off a terminal without --yes it exits 4 before reading the secret or calling the API', async () => {
    const seen = useConnectionApi()
    const result = await cli(
      [
        'integrations',
        'connect',
        'supabase_auth',
        '--signing-secret-env',
        'HOOK_SECRET',
        '--json',
      ],
      { env: { HOOK_SECRET: SUPABASE_SECRET } }
    )
    expect(result.code).toBe(4)
    expect(seen).toEqual([])
    expect(result.json).toMatchObject({
      confirmationRequired: true,
      confirmCommand:
        'brew-cli integrations connect supabase_auth --signing-secret-env HOOK_SECRET --json --yes',
    })
  })

  it.each([
    [
      'no secret source',
      ['integrations', 'connect', 'clerk', '--yes'],
      {},
      'never a flag value',
    ],
    [
      'an unset variable',
      [
        'integrations',
        'connect',
        'clerk',
        '--signing-secret-env',
        'NOPE',
        '--yes',
      ],
      {},
      'NOPE is not set',
    ],
    [
      'a secret in the wrong shape (a Clerk secret for Supabase)',
      [
        'integrations',
        'connect',
        'supabase_auth',
        '--signing-secret-env',
        'HOOK_SECRET',
        '--yes',
      ],
      { HOOK_SECRET: CLERK_SECRET },
      'does not look like a Supabase Send Email hook secret',
    ],
    [
      'the secret itself as the variable name',
      [
        'integrations',
        'connect',
        'clerk',
        '--signing-secret-env',
        CLERK_SECRET.replace('+', ''),
        '--yes',
      ],
      {},
      'takes an environment variable NAME',
    ],
    [
      'both sources',
      [
        'integrations',
        'connect',
        'clerk',
        '--signing-secret-env',
        'X',
        '--signing-secret-stdin',
        '--yes',
      ],
      { X: CLERK_SECRET },
      'not both',
    ],
    [
      'an unknown provider',
      [
        'integrations',
        'connect',
        'stripe',
        '--signing-secret-env',
        'X',
        '--yes',
      ],
      { X: CLERK_SECRET },
      'supabase_auth or clerk',
    ],
    [
      '--project-url for Clerk',
      [
        'integrations',
        'connect',
        'clerk',
        '--signing-secret-env',
        'X',
        '--project-url',
        'https://abcdefghijklmnopqrst.supabase.co',
        '--yes',
      ],
      { X: CLERK_SECRET },
      'supabase_auth only',
    ],
  ])('exits 2 with no request on %s', async (_name, argv, env, message) => {
    const seen = useConnectionApi()
    const result = await cli([...argv, '--json'], { env })
    expect(result.code).toBe(2)
    expect(seen).toEqual([])
    expect(result.stdout + result.stderr).toContain(message)
  })

  it('a 400 from the API exits 1 with its envelope, and the secret stays out of it', async () => {
    useConnectionApi({ putStatus: 400 })
    const result = await cli(
      [
        'integrations',
        'connect',
        'clerk',
        '--signing-secret-env',
        'X',
        '--yes',
        '--json',
      ],
      { env: { X: CLERK_SECRET } }
    )
    expect(result.code).toBe(1)
    expect(result.stdout + result.stderr).toContain('INVALID_REQUEST')
  })
})

describe('integrations connection', () => {
  it('prints the connection', async () => {
    const seen = useConnectionApi()
    const result = await cli(['integrations', 'connection', 'clerk', '--json'])
    expect(result.code).toBe(0)
    expect(seen.map((entry) => `${entry.method} ${entry.path}`)).toEqual([
      'GET /api/v1/integrations/clerk/connection',
    ])
    expect(result.json).toEqual({
      provider: 'clerk',
      connectionId: 'conn_clerk',
      webhookUrl: 'https://brew.new/api/integrations/clerk/webhook/conn_clerk',
      status: 'active',
    })
  })

  it('a provider that is not connected is 404 NOT_FOUND, exit 1', async () => {
    useConnectionApi({ getStatus: 404 })
    const result = await cli([
      'integrations',
      'connection',
      'supabase_auth',
      '--json',
    ])
    expect(result.code).toBe(1)
    expect(result.stdout + result.stderr).toContain('NOT_FOUND')
  })
})
