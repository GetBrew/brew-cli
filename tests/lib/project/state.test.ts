import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BREW_STATE_SCHEMA_URL,
  BrewStateError,
  createBrewState,
  parseBrewState,
  readBrewState,
  serializeBrewState,
} from '../../../src/lib/project/state'
import { tempProject } from '../../helpers/fixtures'

const PROJECT_ID = '0b7f3c1e-9a2d-4e8b-b6c5-3d1f2a9e8c47'
const SHA = 'a'.repeat(64)

describe('brew.json state', () => {
  it('creates a v1 state with a fresh UUID and empty maps', () => {
    const state = createBrewState()
    expect(state.version).toBe(1)
    expect(state.$schema).toBe(BREW_STATE_SCHEMA_URL)
    expect(state.projectId).toMatch(/^[0-9a-f-]{36}$/)
    expect(state.emails).toEqual({})
    expect(state.files).toEqual({})
  })

  it('serializes with a stable key order, whatever order it was built in', () => {
    const state = createBrewState({
      projectId: PROJECT_ID,
      mcp: ['vscode', 'cursor', 'cursor'],
      files: {
        'lib/brew.ts': { generator: 'init', sha256: SHA },
        '.env.example': { sha256: SHA, generator: 'init' },
      },
      emails: {
        'lifecycle.welcome': { automationId: 'am_2', triggerEventId: 'tev_2' },
        'auth.verify-email': { triggerEventId: 'tev_1', automationId: 'am_1' },
      },
      providerConfig: { supabase: { z: 1, a: { y: 2, b: 3 } } },
      framework: 'next',
      brandId: 'bd_1',
    })
    const text = serializeBrewState(state)
    expect(text).toBe(
      `${JSON.stringify(
        {
          $schema: BREW_STATE_SCHEMA_URL,
          version: 1,
          projectId: PROJECT_ID,
          brandId: 'bd_1',
          framework: 'next',
          emails: {
            'auth.verify-email': {
              triggerEventId: 'tev_1',
              automationId: 'am_1',
            },
            'lifecycle.welcome': {
              triggerEventId: 'tev_2',
              automationId: 'am_2',
            },
          },
          files: {
            '.env.example': { sha256: SHA, generator: 'init' },
            'lib/brew.ts': { sha256: SHA, generator: 'init' },
          },
          providerConfig: { supabase: { a: { b: 3, y: 2 }, z: 1 } },
          mcp: ['cursor', 'vscode'],
        },
        null,
        2
      )}\n`
    )
    const reparsed = parseBrewState(text)
    expect(reparsed.ok).toBe(true)
    if (reparsed.ok) {
      expect(serializeBrewState(reparsed.state, reparsed.extra)).toBe(text)
    }
  })

  it('keeps unknown top-level keys from a newer CLI on rewrite', () => {
    const text = JSON.stringify({
      version: 1,
      projectId: PROJECT_ID,
      emails: {},
      files: {},
      zeta: true,
      alpha: { kept: 1 },
    })
    const parsed = parseBrewState(text)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.extra).toEqual({ zeta: true, alpha: { kept: 1 } })
      const out = JSON.parse(serializeBrewState(parsed.state, parsed.extra))
      expect(Object.keys(out).slice(-2)).toEqual(['alpha', 'zeta'])
    }
  })

  it('validates by hand, naming every problem', () => {
    const parsed = parseBrewState(
      JSON.stringify({
        version: 2,
        projectId: 'nope',
        brandId: '',
        contractsPath: '../outside.ts',
        emails: { 'Bad Key': { triggerEventId: 'tev_1' } },
        files: { '/abs.ts': { sha256: 'short', generator: '' } },
        mcp: 'cursor',
      })
    )
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.errors).toEqual([
        'version must be 1 (got 2); a newer CLI may have written this file',
        'projectId must be a UUID',
        'brandId must be a non-empty string',
        'contractsPath must be a project-relative path',
        'emails.Bad Key: not a valid trigger key',
        'emails.Bad Key must be { triggerEventId: string, automationId: string }',
        'files./abs.ts: not a project-relative path',
        'files./abs.ts must be { sha256: <64 hex chars>, generator: string }',
        'mcp must be an array of client ids',
      ])
    }
    expect(parseBrewState('{').ok).toBe(false)
    expect(parseBrewState('[]').ok).toBe(false)
  })

  it('reads brew.json from a project root: absent, valid, invalid', () => {
    const root = tempProject()
    expect(readBrewState(root)).toBeNull()
    const state = createBrewState({ projectId: PROJECT_ID })
    writeFileSync(join(root, 'brew.json'), serializeBrewState(state))
    expect(readBrewState(root)?.state.projectId).toBe(PROJECT_ID)
    writeFileSync(join(root, 'brew.json'), '{"version":1}')
    expect(() => readBrewState(root)).toThrow(BrewStateError)
  })

  it('ships a JSON Schema that covers exactly the known keys', () => {
    const schema = JSON.parse(
      readFileSync(
        new URL('../../../schemas/brew.json', import.meta.url),
        'utf8'
      )
    ) as { $id: string; properties: Record<string, unknown> }
    expect(schema.$id).toBe(BREW_STATE_SCHEMA_URL)
    expect(Object.keys(schema.properties)).toEqual(
      Object.keys(
        JSON.parse(
          serializeBrewState(
            createBrewState({
              projectId: PROJECT_ID,
              brandId: 'b',
              framework: 'f',
              auth: 'a',
              contractsPath: 'c.ts',
              providerConfig: {},
              mcp: [],
            })
          )
        )
      )
    )
  })
})
