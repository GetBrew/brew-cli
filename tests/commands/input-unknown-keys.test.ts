import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { INPUT_KEYS } from '../../src/generated/input-keys'
import { INPUT_FLAG } from '../../src/lib/input'
import { ALL_COMMANDS } from '../../src/registry'
import { server } from '../helpers/msw-server'
import { type RunCliResult, runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const API = 'https://brew.new/api'

function cli(
  argv: readonly string[],
  options: { readonly stdin?: string } = {}
): Promise<RunCliResult> {
  return runCli(argv, {
    env: {
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
      BREW_API_KEY: KEY,
    },
    ...options,
  })
}

describe('unknown --input keys', () => {
  it('refuses an unknown key on a query read and suggests the near one', async () => {
    const result = await cli([
      'analytics',
      'events',
      '--input',
      '{"recipent":"jane@example.com"}',
    ])
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('`recipent` (did you mean `recipient`?)')
  })

  it('refuses an unknown key in a JSON body, matching case-insensitively', async () => {
    const result = await cli([
      'contacts',
      'upsert',
      '--input',
      '{"email":"jane@example.com","firstname":"Jane"}',
    ])
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('`firstname` (did you mean `firstName`?)')
  })

  it('refuses an unknown key read from stdin', async () => {
    const result = await cli(['contacts', 'upsert', '--input', '-'], {
      stdin: '{"email":"jane@example.com","madeUp":true}',
    })
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('`madeUp`')
  })

  it('refuses inline input before the confirmation gate', async () => {
    const result = await cli([
      'emails',
      'send',
      'em_1',
      '--input',
      '{"bogus":1}',
    ])
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('`bogus`')
  })

  it('passes a shorthand payload whose keys are the user’s own', async () => {
    let body: unknown
    server.use(
      http.post(
        `${API}/v1/automations/triggers/tri_1/fire`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ accepted: true })
        }
      )
    )
    const result = await cli([
      'automations',
      'triggers',
      'fire',
      'tri_1',
      '--input',
      '{"email":"jane@example.com","plan":"pro"}',
      '--yes',
    ])
    expect(result.code).toBe(0)
    expect(body).toMatchObject({
      payload: { email: 'jane@example.com', plan: 'pro' },
    })
  })

  it('passes an array body unchecked', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/contacts`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ results: [] })
      })
    )
    const result = await cli([
      'contacts',
      'upsert-many',
      '--input',
      '[{"email":"jane@example.com"}]',
    ])
    expect(result.code).toBe(0)
    expect(body).toMatchObject({ contacts: [{ email: 'jane@example.com' }] })
  })

  it('leaves a retired filter to the command’s own refusal', async () => {
    const result = await cli([
      'brand',
      'get-images',
      '--input',
      '{"aspectRatio":"16:9"}',
    ])
    expect(result.code).toBe(2)
    expect(result.stderr).not.toContain('Unknown --input')
  })
})

describe('input key coverage', () => {
  const checked = ALL_COMMANDS.filter(
    (spec) =>
      spec.inputKeys !== 'unchecked' &&
      spec.route !== undefined &&
      (spec.flags ?? []).includes(INPUT_FLAG)
  )

  it('maps every checked --input command to its route’s keys', () => {
    const unmapped = checked
      .filter(
        (spec) =>
          INPUT_KEYS[`${spec.route?.method} ${spec.route?.path}`] === undefined
      )
      .map((spec) => spec.path.join(' '))
    expect(unmapped).toEqual([])
  })

  it('declares no extra key the route already takes', () => {
    const stale = checked.flatMap((spec) => {
      const routeKeys = new Set(
        INPUT_KEYS[`${spec.route?.method} ${spec.route?.path}`] ?? []
      )
      const extra =
        typeof spec.inputKeys === 'object' ? spec.inputKeys.extra : []
      return extra
        .filter((key) => routeKeys.has(key))
        .map((key) => `${spec.path.join(' ')}: ${key}`)
    })
    expect(stale).toEqual([])
  })
})
