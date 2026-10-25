import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const EMAIL = 'jane+update@example.com'
const CONSENT = {
  source: 'api',
  capturedAt: '2026-10-20T00:00:00Z',
  policyVersion: 'synthetic-cli-input-probe',
  evidence: 'Synthetic opted-out test fixture; no actual opt-in asserted.',
}
const RESPONSE = { contact: { email: EMAIL }, updated: ['firstName'] }

function env(): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    BREW_API_KEY: 'brew_abcdefghijklmnopqrstuvwxyz012345',
  }
}

function capturePatches() {
  const requests: Array<{ path: string; body: unknown }> = []
  server.use(
    http.patch(
      'https://brew.new/api/v1/contacts/:email',
      async ({ request }) => {
        requests.push({
          path: new URL(request.url).pathname,
          body: await request.json(),
        })
        return HttpResponse.json(RESPONSE)
      }
    )
  )
  return requests
}

describe('contacts update', () => {
  const cases: ReadonlyArray<{
    name: string
    input: Record<string, unknown>
    flags: readonly string[]
    body: Record<string, unknown>
  }> = [
    {
      name: 'accepts the documented fields body without double wrapping',
      input: { fields: { firstName: 'RestControl' } },
      flags: [],
      body: { fields: { firstName: 'RestControl' } },
    },
    {
      name: 'accepts consent alone without adding fields',
      input: { consent: CONSENT },
      flags: [],
      body: { consent: CONSENT },
    },
    {
      name: 'omits empty fields alongside consent',
      input: { fields: {}, consent: CONSENT },
      flags: [],
      body: { consent: CONSENT },
    },
    {
      name: 'keeps consent beside fields and preserves arbitrary field values',
      input: {
        fields: {
          subscribed: false,
          lastName: null,
          preferences: { plan: 'pro' },
        },
        consent: CONSENT,
      },
      flags: [],
      body: {
        fields: {
          subscribed: false,
          lastName: null,
          preferences: { plan: 'pro' },
        },
        consent: CONSENT,
      },
    },
    {
      name: 'preserves prototype-like custom field names as data',
      input: {
        fields: { ['__proto__']: { plan: 'pro' }, constructor: 'custom' },
      },
      flags: [],
      body: {
        fields: { ['__proto__']: { plan: 'pro' }, constructor: 'custom' },
      },
    },
    {
      name: 'keeps nested fields and consent keys inside the field bag',
      input: {
        fields: { fields: 'custom', consent: 'field value' },
        consent: CONSENT,
      },
      flags: [],
      body: {
        fields: { fields: 'custom', consent: 'field value' },
        consent: CONSENT,
      },
    },
    {
      name: 'preserves legacy flat input',
      input: { firstName: 'FlatControl', subscribed: false, plan: 'pro' },
      flags: [],
      body: {
        fields: { firstName: 'FlatControl', subscribed: false, plan: 'pro' },
      },
    },
    {
      name: 'lets flags override flat input while keeping consent at the top level',
      input: { firstName: 'FlatControl', consent: CONSENT },
      flags: ['--first-name', 'FlagControl'],
      body: { fields: { firstName: 'FlagControl' }, consent: CONSENT },
    },
    {
      name: 'lets flags override nested fields without losing other fields',
      input: {
        fields: { firstName: 'Nested', lastName: 'Retained', subscribed: true },
      },
      flags: ['--first-name', 'FlagControl', '--subscribed', 'false'],
      body: {
        fields: {
          firstName: 'FlagControl',
          lastName: 'Retained',
          subscribed: false,
        },
      },
    },
    {
      name: 'merges flat then nested then flags, with --set retaining priority',
      input: {
        firstName: 'Flat',
        lastName: 'Flat',
        plan: 'flat',
        fields: { firstName: 'Nested', lastName: 'Nested', seats: 4 },
        consent: CONSENT,
      },
      flags: [
        '--first-name',
        'Flag',
        '--set',
        'firstName=Set',
        'plan=enterprise',
      ],
      body: {
        fields: {
          firstName: 'Set',
          lastName: 'Nested',
          plan: 'enterprise',
          seats: 4,
        },
        consent: CONSENT,
      },
    },
    {
      name: 'adds field flags to a consent-only body',
      input: { consent: CONSENT },
      flags: ['--last-name', 'FlagControl'],
      body: { fields: { lastName: 'FlagControl' }, consent: CONSENT },
    },
  ]

  describe.each(['inline', 'stdin'])('%s input', (mode) => {
    it.each(cases)('$name', async ({ input, flags, body }) => {
      const requests = capturePatches()
      const json = JSON.stringify(input)
      const result = await runCli(
        [
          'contacts',
          'update',
          EMAIL,
          '--input',
          mode === 'stdin' ? '-' : json,
          ...flags,
          '--json',
        ],
        { env: env(), stdin: json }
      )
      expect(result.code).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.json).toEqual(RESPONSE)
      expect(requests).toEqual([
        { path: '/api/v1/contacts/jane%2Bupdate%40example.com', body },
      ])
    })
  })

  it('preserves flag-only updates', async () => {
    const requests = capturePatches()
    const result = await runCli(
      [
        'contacts',
        'update',
        EMAIL,
        '--first-name',
        'Jane',
        '--subscribed',
        'false',
        '--set',
        'plan=pro',
      ],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(requests[0]?.body).toEqual({
      fields: { firstName: 'Jane', subscribed: false, plan: 'pro' },
    })
  })

  it.each([
    { input: undefined, message: 'Nothing to update' },
    { input: '{}', message: 'Nothing to update' },
    { input: '{"fields":{}}', message: 'Nothing to update' },
    { input: '{', message: '--input must be valid JSON' },
    ...['null', 'true', '42', '"text"', '[]', '[{"firstName":"Jane"}]'].map(
      (input) => ({
        input,
        message: '--input must be a JSON object',
      })
    ),
    ...['null', 'true', '42', '"text"', '[]'].map((fields) => ({
      input: `{"fields":${fields}}`,
      message: '--input.fields must be a JSON object',
    })),
  ])(
    'rejects invalid or empty input $input without a request',
    async ({ input, message }) => {
      const requests = capturePatches()
      const result = await runCli(
        [
          'contacts',
          'update',
          EMAIL,
          ...(input === undefined ? [] : ['--input', input]),
        ],
        { env: env() }
      )
      expect(result.code).toBe(2)
      expect(result.stderr).toContain(message)
      expect(requests).toEqual([])
    }
  )

  it('leaves consent validation to the API and does not retry PATCH', async () => {
    const bodies: unknown[] = []
    const error = {
      error: {
        code: 'INVALID_REQUEST',
        type: 'validation',
        message: 'Invalid consent',
      },
    }
    server.use(
      http.patch(
        'https://brew.new/api/v1/contacts/:email',
        async ({ request }) => {
          bodies.push(await request.json())
          return HttpResponse.json(error, { status: 422 })
        }
      )
    )
    const result = await runCli(
      ['contacts', 'update', EMAIL, '--input', '{"consent":null}'],
      { env: env() }
    )
    expect(result.code).toBe(1)
    expect(JSON.parse(result.stderr).error.code).toBe('INVALID_REQUEST')
    expect(bodies).toEqual([{ consent: null }])
  })
})
