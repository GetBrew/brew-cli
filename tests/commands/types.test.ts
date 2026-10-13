import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { automationsTriggersReadyCommand } from '../../src/commands/automations/triggers/ready'
import { typesCommand } from '../../src/commands/types'
import type { components } from '../../src/generated/openapi-types'
import { defineCommand } from '../../src/lib/define-command'
import { CliInterruptError } from '../../src/lib/errors'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const API = 'https://brew.new/api'

function env(): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    BREW_API_KEY: KEY,
  }
}

const TRIGGER = {
  triggerEventId: 'tri_signup',
  title: 'User Signed Up',
  provider: 'brew_api',
  payloadSchema: {
    type: 'object',
    fields: [
      { key: 'email', type: 'string', required: true },
      { key: 'seats', type: 'int', required: false },
      { key: 'kebab-key', type: 'string', required: false },
    ],
  },
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const NESTED_ARTIFACT = [
  '/** Fire: POST /v1/automations/triggers/tri_order_receipt/fire — body { payload: OrderReceiptPayload } */',
  'export type OrderReceiptPayload = {',
  '  email: string',
  '  order: {',
  '    total: number',
  '    items: Array<{',
  '      name: string',
  '      qty?: number',
  '    }>',
  '  }',
  '  tags?: Array<string>',
  '  status: "paid" | "refunded"',
  '  placedAt: string',
  '  meta?: unknown',
  '  note?: string',
  '}',
].join('\n')

beforeEach(() => {
  server.use(
    http.get(
      `${API}/v1/automations/triggers/:id/contract`,
      ({ request, params }) => {
        expect(new URL(request.url).searchParams.get('format')).toBe('ts')
        const id = String(params.id)
        let name = 'UserSignedUpPayload'
        if (id === 'tri_order_receipt') name = 'OrderReceiptPayload'
        if (id === 'tri_l') name = 'Payload2026Launch'
        if (id === 'tri_tail' || id === 'tri_page_51')
          name = 'TailTriggerPayload'
        if (id.startsWith('tri_page1_'))
          name = `PageOne${Number(id.slice('tri_page1_'.length))}Payload`
        const content =
          id === 'tri_order_receipt'
            ? NESTED_ARTIFACT
            : `export type ${name} = {\n  email: string\n  seats?: number\n  "kebab-key"?: string\n}\n`
        return HttpResponse.json({
          format: 'ts',
          typeName: name,
          subjectKind: 'trigger',
          subjectId: id,
          source: 'stored',
          content,
        })
      }
    )
  )
})

function mockApi() {
  server.use(
    http.get(`${API}/v1/automations/triggers`, () =>
      HttpResponse.json({
        data: [TRIGGER],
        pagination: { cursor: null, hasMore: false },
      })
    )
  )
}

describe('types', () => {
  it('emits deterministic typed trigger contracts', async () => {
    mockApi()
    const dir = mkdtempSync(join(tmpdir(), 'brew-types-'))
    const out = join(dir, 'brew-contracts.ts')
    const first = await runCli(['types', '--out', out], {
      extraCommands: [typesCommand],
      env: env(),
    })
    expect(first.code).toBe(0)
    const text = readFileSync(out, 'utf8')

    expect(text.startsWith('// brew:contracts sha256:')).toBe(true)
    // Declared schema, int → number, invalid keys quoted.
    expect(text).toContain('export type UserSignedUpPayload = {')
    expect(text).toContain('  email: string')
    expect(text).toContain('  seats?: number')
    expect(text).toContain('  "kebab-key"?: string')

    // Byte-determinism: a second run writes the identical file.
    const again = await runCli(['types', '--out', out], {
      extraCommands: [typesCommand],
      env: env(),
    })
    expect(again.code).toBe(0)
    expect(readFileSync(out, 'utf8')).toBe(text)
  })

  it('--check passes on a fresh file and fails on drift', async () => {
    mockApi()
    const dir = mkdtempSync(join(tmpdir(), 'brew-types-'))
    const out = join(dir, 'brew-contracts.ts')
    const testEnv = env()
    await runCli(['types', '--out', out], {
      env: testEnv,
      extraCommands: [typesCommand],
    })

    const clean = await runCli(['types', '--out', out, '--check'], {
      env: testEnv,
      extraCommands: [typesCommand],
    })
    expect(clean.code).toBe(0)

    writeFileSync(out, `${readFileSync(out, 'utf8')}\n// local edit\n`)
    const drifted = await runCli(['types', '--out', out, '--check'], {
      env: testEnv,
      extraCommands: [typesCommand],
    })
    // Documented drift contract: exit 1 specifically (2 = usage error).
    expect(drifted.code).toBe(1)
    expect(
      (drifted.json as { upToDate: boolean } | null)?.upToDate ?? null
    ).toBe(false)
  })
})

describe('types — nested contracts', () => {
  const NESTED_TRIGGER = {
    triggerEventId: 'tri_order_receipt',
    title: 'Order Receipt',
    provider: 'brew_api',
    payloadSchema: {
      type: 'object',
      fields: [
        { key: 'email', type: 'string', required: true },
        {
          key: 'order',
          type: 'object',
          required: true,
          children: [
            { key: 'total', type: 'float', required: true },
            {
              key: 'items',
              type: 'array',
              required: true,
              children: [
                { key: 'name', type: 'string', required: true },
                { key: 'qty', type: 'int', required: false },
              ],
            },
          ],
        },
        { key: 'tags', type: 'array', required: false, itemType: 'string' },
        {
          key: 'status',
          type: 'enum',
          required: true,
          enumValues: ['paid', 'refunded'],
        },
        { key: 'placedAt', type: 'date', required: true },
        { key: 'meta', type: 'unknown', required: false },
        { key: 'note', type: 'string', required: false },
      ],
    },
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  }

  // The exact shape the platform codegen (lib/payload-contract/codegen.ts)
  // emits — and the docs guide's OrderReceiptPayload example: inline
  // nested object literals, Array<{ … }> members, two-space indent per
  // level, unions from enumValues.

  function mockNestedApi() {
    server.use(
      http.get(`${API}/v1/automations/triggers`, () =>
        HttpResponse.json({
          data: [NESTED_TRIGGER],
          pagination: { cursor: null, hasMore: false },
        })
      )
    )
  }

  it('emits nested object / array-of-object / scalar-array / enum fields exactly', async () => {
    mockNestedApi()
    const dir = mkdtempSync(join(tmpdir(), 'brew-types-'))
    const out = join(dir, 'brew-contracts.ts')
    const result = await runCli(['types', '--out', out], {
      extraCommands: [typesCommand],
      env: env(),
    })
    expect(result.code).toBe(0)
    expect(readFileSync(out, 'utf8')).toContain(NESTED_ARTIFACT)
  })

  it('--check stays deterministic for nested output', async () => {
    mockNestedApi()
    const dir = mkdtempSync(join(tmpdir(), 'brew-types-'))
    const out = join(dir, 'brew-contracts.ts')
    const testEnv = env()
    await runCli(['types', '--out', out], {
      env: testEnv,
      extraCommands: [typesCommand],
    })
    const first = readFileSync(out, 'utf8')

    const check = await runCli(['types', '--out', out, '--check'], {
      env: testEnv,
      extraCommands: [typesCommand],
    })
    expect(check.code).toBe(0)

    const again = await runCli(['types', '--out', out], {
      env: testEnv,
      extraCommands: [typesCommand],
    })
    expect(again.code).toBe(0)
    expect(readFileSync(out, 'utf8')).toBe(first)
  })
})

describe('types — audit hardening', () => {
  it.each([false, true])(
    'preserves the artifact when interrupted after the final read (check=%s)',
    async (isCheck) => {
      mockApi()
      const controller = new AbortController()
      const dir = mkdtempSync(join(tmpdir(), 'brew-types-'))
      const out = join(dir, 'brew-contracts.ts')
      const existing = '// Existing contracts must survive an interruption.\n'
      writeFileSync(out, existing)
      const command = defineCommand({
        ...typesCommand,
        path: ['types-final-page-fixture'],
        run: async (invocation) => {
          const triggers = invocation.ctx.client().automations.triggers
          const list = triggers.list.bind(triggers)
          vi.spyOn(triggers, 'list').mockImplementation(async (...args) => {
            const response = await list(...args)
            controller.abort(new CliInterruptError('SIGINT'))
            return response
          })
          return typesCommand.run(invocation)
        },
      })

      const result = await runCli(
        [
          'types-final-page-fixture',
          '--out',
          out,
          '--quiet',
          ...(isCheck ? ['--check'] : []),
        ],
        {
          env: env(),
          signal: controller.signal,
          extraCommands: [command],
        }
      )

      expect(result.code).toBe(130)
      expect(result.stdout).toBe('')
      expect(JSON.parse(result.stderr)).toMatchObject({
        error: { code: 'CLI_INTERRUPTED', type: 'cancelled' },
      })
      expect(readFileSync(out, 'utf8')).toBe(existing)
    }
  )

  it.each([
    { cursors: ['a', 'a'], isCheck: false },
    { cursors: ['a', 'b', 'a'], isCheck: false },
    { cursors: ['a', 'a'], isCheck: true },
    { cursors: ['a', 'b', 'a'], isCheck: true },
  ])(
    'rejects cursor cycles before writing or certifying a payload contract file',
    async ({ cursors, isCheck }) => {
      const requested: Array<string | null> = []
      server.use(
        http.get(`${API}/v1/automations/triggers`, ({ request }) => {
          requested.push(new URL(request.url).searchParams.get('cursor'))
          return HttpResponse.json({
            data: [TRIGGER],
            pagination: {
              cursor: cursors[(requested.length - 1) % cursors.length],
              hasMore: true,
            },
          })
        })
      )
      const dir = mkdtempSync(join(tmpdir(), 'brew-types-'))
      const out = join(dir, 'brew-contracts.ts')
      const existing = '// Existing contracts must survive a failed read.\n'
      writeFileSync(out, existing)

      const result = await runCli(
        ['types', '--out', out, '--quiet', ...(isCheck ? ['--check'] : [])],
        { env: env(), extraCommands: [typesCommand] }
      )

      expect(result.code).toBe(1)
      expect(result.stdout).toBe('')
      expect(JSON.parse(result.stderr)).toMatchObject({
        error: {
          code: 'CLI_PAGINATION',
          progress: {
            rowsFetched: cursors.length,
            pagesFetched: cursors.length,
          },
        },
      })
      expect(requested).toEqual([null, ...cursors.slice(0, -1)])
      expect(readFileSync(out, 'utf8')).toBe(existing)
    }
  )

  it('includes payload contracts after the former fifty-page ceiling', async () => {
    let reads = 0
    server.use(
      http.get(`${API}/v1/automations/triggers`, ({ request }) => {
        reads += 1
        const cursor = new URL(request.url).searchParams.get('cursor')
        const page = cursor === null ? 1 : Number(cursor)
        return HttpResponse.json({
          data: [
            {
              ...TRIGGER,
              triggerEventId: `tri_page_${page}`,
              title: page === 51 ? 'Tail Trigger' : `Page ${page}`,
            },
          ],
          pagination: {
            cursor: page === 51 ? null : String(page + 1),
            hasMore: page < 51,
          },
        })
      })
    )
    const dir = mkdtempSync(join(tmpdir(), 'brew-types-'))
    const out = join(dir, 'brew-contracts.ts')
    const result = await runCli(['types', '--out', out, '--quiet'], {
      env: env(),
      extraCommands: [typesCommand],
    })

    expect(result.code).toBe(0)
    expect(readFileSync(out, 'utf8')).toContain('TailTriggerPayload')
    expect(result.json).toMatchObject({ triggers: 51 })
    expect(reads).toBe(51)
  })

  it('follows the pagination cursor instead of capping at one page', async () => {
    const pageOne = Array.from({ length: 100 }, (_, i) => ({
      ...TRIGGER,
      triggerEventId: `tri_page1_${String(i).padStart(3, '0')}`,
      title: `Page One ${i}`,
    }))
    const pageTwo = [
      { ...TRIGGER, triggerEventId: 'tri_tail', title: 'Tail Trigger' },
    ]
    server.use(
      http.get(`${API}/v1/automations/triggers`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        return cursor === 'c2'
          ? HttpResponse.json({
              data: pageTwo,
              pagination: { cursor: null, hasMore: false },
            })
          : HttpResponse.json({
              data: pageOne,
              pagination: { cursor: 'c2', hasMore: true },
            })
      })
    )
    const dir = mkdtempSync(join(tmpdir(), 'brew-types-'))
    const out = join(dir, 'brew-contracts.ts')
    const result = await runCli(['types', '--out', out], {
      env: env(),
      extraCommands: [typesCommand],
    })
    expect(result.code).toBe(0)
    const text = readFileSync(out, 'utf8')
    expect(text).toContain('TailTriggerPayload')
    expect((result.json as { triggers: number }).triggers).toBe(101)
  })

  it('deduplicates colliding type names so the file always compiles', async () => {
    server.use(
      http.get(`${API}/v1/automations/triggers`, () =>
        HttpResponse.json({
          data: [
            { ...TRIGGER, triggerEventId: 'tri_a', title: 'User Signed Up' },
            { ...TRIGGER, triggerEventId: 'tri_b', title: 'user signed-up!' },
          ],
          pagination: { cursor: null, hasMore: false },
        })
      )
    )
    const dir = mkdtempSync(join(tmpdir(), 'brew-types-'))
    const out = join(dir, 'brew-contracts.ts')
    await runCli(['types', '--out', out], {
      env: env(),
      extraCommands: [typesCommand],
    })
    const text = readFileSync(out, 'utf8')
    const declarations = text.match(/export type (\w+) =/g) ?? []
    expect(declarations.length).toBe(2)
    expect(new Set(declarations).size).toBe(2)
    expect(text).toContain('export type UserSignedUpPayload =')
    expect(text).toContain('export type UserSignedUpPayloadTriB =')
  })

  it('uses the server-minted identifier for a digit-led title', async () => {
    server.use(
      http.get(`${API}/v1/automations/triggers`, () =>
        HttpResponse.json({
          data: [{ ...TRIGGER, triggerEventId: 'tri_l', title: '2026 Launch' }],
          pagination: { cursor: null, hasMore: false },
        })
      )
    )
    const dir = mkdtempSync(join(tmpdir(), 'brew-types-'))
    const out = join(dir, 'brew-contracts.ts')
    await runCli(['types', '--out', out], {
      env: env(),
      extraCommands: [typesCommand],
    })
    expect(readFileSync(out, 'utf8')).toContain(
      'export type Payload2026Launch ='
    )
  })

  it('--check tolerates CRLF checkouts', async () => {
    mockApi()
    const dir = mkdtempSync(join(tmpdir(), 'brew-types-'))
    const out = join(dir, 'brew-contracts.ts')
    const testEnv = env()
    await runCli(['types', '--out', out], {
      env: testEnv,
      extraCommands: [typesCommand],
    })
    writeFileSync(out, readFileSync(out, 'utf8').replaceAll('\n', '\r\n'))
    const result = await runCli(['types', '--out', out, '--check'], {
      env: testEnv,
      extraCommands: [typesCommand],
    })
    expect(result.code).toBe(0)
  })
})

describe('automations triggers ready', () => {
  it('hits the GET readiness probe for the exact trigger', async () => {
    let requestedPath: string | undefined
    server.use(
      http.get(
        `${API}/v1/automations/triggers/tri_signup/readiness`,
        ({ request }) => {
          requestedPath = new URL(request.url).pathname
          return HttpResponse.json({
            ready: true,
            blockers: [],
            triggerEventId: 'tri_signup',
          })
        }
      )
    )
    const result = await runCli(
      ['automations', 'triggers', 'ready', 'tri_signup'],
      {
        env: env(),
        extraCommands: [automationsTriggersReadyCommand],
      }
    )
    expect(result.code).toBe(0)
    expect(requestedPath).toBe(
      '/api/v1/automations/triggers/tri_signup/readiness'
    )
    expect(result.stdout).toContain('ready')
  })

  it('passes an integration trigger delivery status through verbatim (brew-v2#1897)', async () => {
    const readiness = {
      triggerEventId: 'shopify:customers/update',
      ready: true,
      blockers: [],
      publishedAutomations: [{ automationId: 'am_1' }],
      counts: { automations: 1, skipped: 0 },
      delivery: {
        status: 'never_received',
        sourceEvent: 'Customer update',
        message:
          'Brew has not received this event. In Shopify, add a webhook for Customer update.',
      },
    } satisfies components['schemas']['TriggerReadiness']
    server.use(
      http.get(
        `${API}/v1/automations/triggers/shopify%3Acustomers%2Fupdate/readiness`,
        () => HttpResponse.json(readiness)
      )
    )
    const result = await runCli(
      [
        'automations',
        'triggers',
        'ready',
        'shopify:customers/update',
        '--json',
      ],
      {
        env: env(),
        extraCommands: [automationsTriggersReadyCommand],
      }
    )
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual(readiness)
  })
})

describe('types — trigger key registry', () => {
  const KEYED = [
    { ...TRIGGER, key: 'user.signup' },
    {
      ...TRIGGER,
      triggerEventId: 'tri_reset',
      title: 'Password reset',
      key: 'auth.password-reset',
    },
  ]

  function mockTriggers(rows: ReadonlyArray<Record<string, unknown>>) {
    server.use(
      http.get(`${API}/v1/automations/triggers`, () =>
        HttpResponse.json({
          data: rows,
          pagination: { cursor: null, hasMore: false },
        })
      )
    )
  }

  it('stays byte-identical to the key-less output when no trigger has a key', async () => {
    mockTriggers([TRIGGER])
    const out = join(mkdtempSync(join(tmpdir(), 'brew-types-')), 'c.ts')
    const result = await runCli(['types', '--out', out], {
      extraCommands: [typesCommand],
      env: env(),
    })
    expect(result.code).toBe(0)
    // Pinned from the pre-registry emitter: a key-less workspace's committed
    // file must not read as drift after the upgrade.
    expect(readFileSync(out, 'utf8')).toBe(
      '// brew:contracts sha256:f15c86b02ba6b9c5eca91fd8c6e4c343df1be1f9cc5a204c4d61e960de7557bf\n// Generated by `brew-cli types` — do not edit by hand.\n// Re-run `brew-cli types` after changing a trigger schema; gate\n// drift in CI with `brew-cli types --check`.\n\n/** Fire: POST /v1/automations/triggers/tri_signup/fire — body { payload: UserSignedUpPayload } */\nexport type UserSignedUpPayload = {\n  email: string\n  seats?: number\n  "kebab-key"?: string\n}\n'
    )
  })

  it('augments BrewTriggerKeyRegistry for keyed triggers, sorted by key', async () => {
    mockTriggers(KEYED)
    const out = join(mkdtempSync(join(tmpdir(), 'brew-types-')), 'c.ts')
    const result = await runCli(['types', '--out', out], {
      extraCommands: [typesCommand],
      env: env(),
    })
    expect(result.code).toBe(0)
    const text = readFileSync(out, 'utf8')
    expect(text).toContain(
      [
        "declare module '@brew.new/sdk' {",
        '  interface BrewTriggerKeyRegistry {',
        '    "auth.password-reset": PasswordResetPayload',
        '    "user.signup": UserSignedUpPayload',
        '  }',
        '}',
        '',
      ].join('\n')
    )
  })

  it('--no-registry leaves the augmentation out', async () => {
    mockTriggers(KEYED)
    const out = join(mkdtempSync(join(tmpdir(), 'brew-types-')), 'c.ts')
    const result = await runCli(['types', '--out', out, '--no-registry'], {
      extraCommands: [typesCommand],
      env: env(),
    })
    expect(result.code).toBe(0)
    expect(readFileSync(out, 'utf8')).not.toContain('declare module')
  })
})
