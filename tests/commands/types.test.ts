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

const TRANSACTIONAL = {
  transactionId: 'txn_receipt',
  emailId: 'em_1',
  emailVersionId: 'ev_1',
  domainId: 'dom_1',
  subject: 'Your receipt',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  variables: [],
  variableTree: [
    {
      key: 'trigger',
      path: 'trigger',
      kind: 'object',
      fallback: null,
      namespace: 'trigger',
      children: [
        {
          key: 'total',
          path: 'trigger.total',
          kind: 'scalar',
          fallback: null,
          namespace: 'trigger',
          children: [],
          inferredType: 'number',
        },
        {
          key: 'note',
          path: 'trigger.note',
          kind: 'scalar',
          fallback: 'none',
          namespace: 'trigger',
          children: [],
        },
      ],
    },
    {
      key: 'customer',
      path: 'customer',
      kind: 'object',
      fallback: null,
      namespace: 'customer',
      children: [],
    },
  ],
}

function mockApi() {
  server.use(
    http.get(`${API}/v1/automations/triggers`, () =>
      HttpResponse.json({
        data: [TRIGGER],
        pagination: { cursor: null, hasMore: false },
      })
    ),
    http.get(`${API}/v1/transactional/txn_receipt`, () =>
      HttpResponse.json(TRANSACTIONAL)
    )
  )
}

describe('types', () => {
  it('emits deterministic typed contracts for both planes', async () => {
    mockApi()
    const dir = mkdtempSync(join(tmpdir(), 'brew-types-'))
    const out = join(dir, 'brew-contracts.ts')
    const first = await runCli(
      ['types', '--out', out, '--transaction', 'txn_receipt'],
      { extraCommands: [typesCommand], env: env() }
    )
    expect(first.code).toBe(0)
    const text = readFileSync(out, 'utf8')

    expect(text.startsWith('// brew:contracts sha256:')).toBe(true)
    // Trigger plane: declared schema, int → number, invalid keys quoted.
    expect(text).toContain('export type UserSignedUpPayload = {')
    expect(text).toContain('  email: string')
    expect(text).toContain('  seats?: number')
    expect(text).toContain('  "kebab-key"?: string')
    // Transactional plane: trigger root unwrapped, customer excluded,
    // no-fallback = required, inferredType honored.
    expect(text).toContain('export type TxnReceiptPayload = {')
    expect(text).toContain('  total: number')
    expect(text).toContain('  note?: string')
    expect(text).not.toContain('customer')

    // Byte-determinism: a second run writes the identical file.
    const again = await runCli(
      ['types', '--out', out, '--transaction', 'txn_receipt'],
      { extraCommands: [typesCommand], env: env() }
    )
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
    expect(drifted.code).not.toBe(0)
    expect(drifted.stderr).toContain('stale')
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
