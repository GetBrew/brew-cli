import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { typesCommand } from '../../src/commands/types'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const API = 'https://brew.new/api/v1/automations/triggers'
const CONTENT =
  'export type StablePayload = { email: string; amount: number; status: "paid" | "refunded" }\nexport const StablePayloadContractHash = "abc" as const\n'

function setup(ids = ['tri_one']) {
  const dir = mkdtempSync(join(tmpdir(), 'brew-canonical-types-'))
  const out = join(dir, 'contracts.ts')
  const env = {
    BREW_CLI_CONFIG_DIR: dir,
    BREW_API_KEY: 'brew_abcdefghijklmnopqrstuvwxyz012345',
  }
  server.use(
    http.get(API, () =>
      HttpResponse.json({
        data: ids.map((triggerEventId) => ({
          triggerEventId,
          title: 'Renamed Trigger',
          provider: 'brew_api',
          payloadSchema: {
            type: 'object',
            fields: [{ key: 'email', type: 'string', required: true }],
          },
          createdAt: '2026-10-12T00:00:00.000Z',
          updatedAt: '2026-10-12T00:00:00.000Z',
        })),
        pagination: { hasMore: false, cursor: null },
      })
    ),
    http.get(`${API}/:id/contract`, ({ request, params }) => {
      expect(new URL(request.url).searchParams.get('format')).toBe('ts')
      return HttpResponse.json({
        subjectKind: 'trigger',
        subjectId: params.id,
        source: 'stored',
        format: 'ts',
        typeName: 'StablePayload',
        content: CONTENT,
      })
    })
  )
  return { out, env }
}

describe('types uses authoritative contract artifacts', () => {
  it('preserves fields missing from the legacy projection and the stable stored name', async () => {
    const { out, env } = setup()
    const result = await runCli(['types', '--out', out], {
      env,
      extraCommands: [typesCommand],
    })
    expect(result.code).toBe(0)
    expect(readFileSync(out, 'utf8')).toContain(CONTENT)
  })

  it('renames only exported identifiers when stable names collide', async () => {
    const { out, env } = setup(['tri_one', 'tri_two'])
    const result = await runCli(['types', '--out', out], {
      env,
      extraCommands: [typesCommand],
    })
    expect(result.code).toBe(0)
    const text = readFileSync(out, 'utf8')
    expect(text).toContain('export type StablePayloadTriTwo =')
    expect(text).toContain('export const StablePayloadTriTwoContractHash =')
  })

  it('leaves the existing output intact if a contract cannot be read', async () => {
    const { out, env } = setup()
    writeFileSync(out, 'keep existing output')
    server.use(
      http.get(`${API}/tri_one/contract`, () =>
        HttpResponse.json(
          {
            error: {
              message: 'missing',
              code: 'NOT_FOUND',
              type: 'invalid_request_error',
            },
          },
          { status: 404 }
        )
      )
    )
    const result = await runCli(['types', '--out', out], {
      env,
      extraCommands: [typesCommand],
    })
    expect(result.code).toBe(1)
    expect(readFileSync(out, 'utf8')).toBe('keep existing output')
  })
})
