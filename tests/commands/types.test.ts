import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { automationsTriggersReadyCommand } from '../../src/commands/automations/triggers/ready'
import { typesCommand } from '../../src/commands/types'
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

describe('types — audit hardening', () => {
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

  it('mirrors the app naming rule: digit-led titles get the Payload prefix', async () => {
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
  it('hits the GET fire preflight for the exact trigger', async () => {
    let requestedPath: string | undefined
    server.use(
      http.get(
        `${API}/v1/automations/triggers/tri_signup/fire`,
        ({ request }) => {
          requestedPath = new URL(request.url).pathname
          return HttpResponse.json({
            success: true,
            status: 'ready',
            code: 'TRIGGER_EVENT_READY',
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
    expect(requestedPath).toBe('/api/v1/automations/triggers/tri_signup/fire')
    expect(result.stdout).toContain('ready')
  })
})
