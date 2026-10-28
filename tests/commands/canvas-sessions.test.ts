import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const env = {
  BREW_API_KEY: 'brew_canvas_test_abcdefghijklmnopqrstuvwxyz',
  BREW_BRAND_ID: 'brand_test',
}
const input = {
  target: { type: 'group', groupId: 'grp_test' },
  user: { externalId: 'user_test', name: 'Alice' },
  parentOrigin: 'https://customer.example',
  permissions: ['read', 'edit', 'presence'],
}
const session = {
  sessionId: 'session_test',
  embedUrl: 'https://brew.new/embed/canvas/session_test',
  bootstrapToken: 'synthetic_one_use_token',
}

describe('canvas sessions', () => {
  it.each(['create', 'refresh'])(
    'prints the complete %s grant in a terminal',
    async (command) => {
      server.use(
        http.post('https://brew.new/api/v1/canvas/sessions*', () =>
          HttpResponse.json(session)
        )
      )
      const args =
        command === 'create'
          ? ['--input', JSON.stringify(input)]
          : ['session_test']
      const result = await runCli(['canvas', 'sessions', command, ...args], {
        env,
        ttyOut: true,
      })
      expect(result.code).toBe(0)
      expect(result.json).toEqual(session)
    }
  )
  it.each([
    ['--user-name', 'Bob', { externalId: 'user_test', name: 'Bob' }],
    [
      '--user-id',
      'user_override',
      { externalId: 'user_override', name: 'Alice' },
    ],
  ])(
    'preserves unspecified user fields when overriding %s',
    async (flag, value, user) => {
      server.use(
        http.post(
          'https://brew.new/api/v1/canvas/sessions',
          async ({ request }) => {
            expect(await request.json()).toEqual({ ...input, user })
            return HttpResponse.json(session)
          }
        )
      )
      expect(
        (
          await runCli(
            [
              'canvas',
              'sessions',
              'create',
              '--input',
              JSON.stringify(input),
              flag,
              value,
            ],
            { env }
          )
        ).code
      ).toBe(0)
    }
  )
  it('creates a brand-scoped grant from stdin without an idempotency key', async () => {
    server.use(
      http.post(
        'https://brew.new/api/v1/canvas/sessions',
        async ({ request }) => {
          expect(request.headers.get('authorization')).toBe(
            `Bearer ${env.BREW_API_KEY}`
          )
          expect(request.headers.get('x-brand-id')).toBe(env.BREW_BRAND_ID)
          expect(request.headers.get('idempotency-key')).toBeNull()
          expect(await request.json()).toEqual(input)
          return HttpResponse.json(session, { status: 201 })
        }
      )
    )
    const result = await runCli(
      ['canvas', 'sessions', 'create', '--input', '-'],
      {
        env,
        stdin: JSON.stringify(input),
      }
    )
    expect(result.code).toBe(0)
    expect(result.json).toEqual(session)
  })

  it('supports ergonomic single-email read-only flags', async () => {
    server.use(
      http.post(
        'https://brew.new/api/v1/canvas/sessions',
        async ({ request }) => {
          expect(await request.json()).toEqual({
            ...input,
            target: { type: 'email', emailId: 'email_test' },
            permissions: ['read'],
          })
          return HttpResponse.json(session, { status: 201 })
        }
      )
    )
    const result = await runCli(
      [
        'canvas',
        'sessions',
        'create',
        '--email-id',
        'email_test',
        '--parent-origin',
        input.parentOrigin,
        '--user-id',
        'user_test',
        '--user-name',
        'Alice',
        '--read-only',
      ],
      { env }
    )
    expect(result.code).toBe(0)
  })

  it('rejects conflicting target flags locally', async () => {
    const result = await runCli(
      [
        'canvas',
        'sessions',
        'create',
        '--email-id',
        'email_test',
        '--group-id',
        'grp_test',
      ],
      { env }
    )
    expect(result.code).toBe(2)
  })

  it('refreshes exactly one encoded session without a replay key or body', async () => {
    server.use(
      http.post(
        'https://brew.new/api/v1/canvas/sessions/:id/refresh',
        async ({ request, params }) => {
          expect(params.id).toBe('session/test')
          expect(request.headers.get('idempotency-key')).toBeNull()
          expect(await request.text()).toBe('')
          return HttpResponse.json(session)
        }
      )
    )
    const result = await runCli(
      ['canvas', 'sessions', 'refresh', 'session/test'],
      { env }
    )
    expect(result.code).toBe(0)
    expect(result.json).toEqual(session)
  })

  it('requires confirmation to revoke and sends no request when declined', async () => {
    const result = await runCli(
      ['canvas', 'sessions', 'revoke', 'session_test'],
      { env }
    )
    expect(result.code).toBe(4)
    expect(result.json).toMatchObject({
      confirmationRequired: true,
      command: 'brew-cli canvas sessions revoke',
      confirmCommand: 'brew-cli canvas sessions revoke --yes -- session_test',
    })
  })

  it('revokes with --yes', async () => {
    server.use(
      http.delete('https://brew.new/api/v1/canvas/sessions/session_test', () =>
        HttpResponse.json({ revoked: true })
      )
    )
    const result = await runCli(
      ['canvas', 'sessions', 'revoke', 'session_test', '--yes'],
      { env }
    )
    expect(result.code).toBe(0)
    expect(result.json).toEqual({ revoked: true })
  })

  it.each(['create', 'refresh'])(
    'never retries a failed %s credential request',
    async (command) => {
      let attempts = 0
      server.use(
        http.post('https://brew.new/api/v1/canvas/sessions*', () => {
          attempts += 1
          return HttpResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Unavailable' } },
            { status: 503 }
          )
        })
      )
      const result = await runCli(
        [
          'canvas',
          'sessions',
          command,
          ...(command === 'create'
            ? ['--input', JSON.stringify(input)]
            : ['session_test']),
        ],
        { env }
      )
      expect(result.code).toBe(1)
      expect(attempts).toBe(1)
    }
  )
})
