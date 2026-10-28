import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const API = 'https://brew.new/api/v1'

function cli(argv: readonly string[], stdin = '') {
  return runCli(argv, {
    stdin,
    env: {
      BREW_API_KEY: 'brew_abcdefghijklmnopqrstuvwxyz012345',
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-input-')),
    },
  })
}

describe('explicit empty string flags', () => {
  it.each([
    { flags: ['--description', ''], body: { description: '' } },
    { flags: ['--description='], body: { description: '' } },
    {
      flags: ['--title', 'Renamed', '--description', ''],
      body: { title: 'Renamed', description: '' },
    },
    {
      flags: ['--input', '{"description":"old"}', '--description', ''],
      body: { description: '' },
    },
    {
      flags: ['--input', '{"description":"from JSON"}'],
      body: { description: 'from JSON' },
    },
  ])('keeps trigger update values for $flags', async ({ flags, body }) => {
    let sent: unknown
    server.use(
      http.patch(`${API}/automations/triggers/tri_1`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ triggerEventId: 'tri_1', ...body })
      })
    )
    const result = await cli([
      'automations',
      'triggers',
      'update',
      'tri_1',
      ...flags,
    ])
    expect(result.code).toBe(0)
    expect(sent).toEqual(body)
  })

  it('clears an automation description with a flag overriding JSON', async () => {
    let sent: unknown
    server.use(
      http.patch(`${API}/automations/am_1`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ automationId: 'am_1', description: '' })
      })
    )
    const result = await cli([
      'automations',
      'update',
      'am_1',
      '--input',
      '{"description":"old"}',
      '--description',
      '',
    ])
    expect(result.code).toBe(0)
    expect(sent).toEqual({ description: '' })
  })

  it.each([
    { flag: '--default-sender-name', key: 'defaultSenderName', status: 200 },
    { flag: '--default-from-email', key: 'defaultFromEmail', status: 400 },
    {
      flag: '--default-reply-to-email',
      key: 'defaultReplyToEmail',
      status: 400,
    },
  ])(
    'forwards $flag and preserves API validation',
    async ({ flag, key, status }) => {
      let sent: unknown
      server.use(
        http.patch(`${API}/domains/dom_1`, async ({ request }) => {
          sent = await request.json()
          return HttpResponse.json(
            status === 200
              ? { domainId: 'dom_1', [key]: '' }
              : {
                  error: {
                    code: 'INVALID_REQUEST',
                    type: 'invalid_request_error',
                    message: `${key} must be a valid email`,
                  },
                },
            { status }
          )
        })
      )
      const result = await cli([
        'domains',
        'update',
        'dom_1',
        '--input',
        JSON.stringify({ [key]: 'previous' }),
        flag,
        '',
      ])
      expect(sent).toEqual({ [key]: '' })
      expect(result.code).toBe(status === 200 ? 0 : 1)
      if (status === 400) expect(result.stderr).toContain('INVALID_REQUEST')
    }
  )
})

describe('required string values', () => {
  it.each([
    ['fields', 'create', '--name', '', '--type', 'string'],
    ['fields', 'create', '--name', 'name', '--type', ''],
    ['emails', 'restore', 'eml_1', '--to-version', ''],
    [
      'emails',
      'import',
      '--input',
      '{"content":"<p>Hello</p>","format":"html"}',
      '--format',
      '',
    ],
    [
      'emails',
      'send',
      'eml_1',
      '--input',
      '{"domainId":"dom_previous"}',
      '--subject',
      'Test',
      '--audience',
      'aud_1',
      '--domain',
      '',
      '--yes',
    ],
    ['emails', 'import-figma', '--url', '', '--yes'],
    ['emails', 'create-inbox-placement-test', 'eml_1', '--domain', ''],
    ['emails', 'export', 'eml_1', '--provider', ''],
    ['automations', 'triggers', 'ensure-brew-event', '--scope', ''],
    [
      'automations',
      'triggers',
      'ensure-brew-event',
      '--scope',
      'domain',
      '--domain-id',
      '',
    ],
  ])('rejects an empty required value: %j', async (...argv) => {
    let requests = 0
    server.use(
      http.all('*', () => {
        requests += 1
        return HttpResponse.json({})
      })
    )
    const result = await cli(argv)
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('CLI_USAGE')
    expect(requests).toBe(0)
  })

  it('sends an explicit empty enum to API validation without defaulting it', async () => {
    let sent: unknown
    server.use(
      http.post(`${API}/content/transform`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json(
          {
            error: {
              code: 'INVALID_REQUEST',
              type: 'invalid_request_error',
              message: 'operation must be resize or optimize',
            },
          },
          { status: 400 }
        )
      })
    )
    const result = await cli([
      'content',
      'transform',
      '--operation',
      '',
      '--url',
      'https://example.com/image.png',
    ])
    expect(sent).toEqual({
      operation: '',
      imageUrl: 'https://example.com/image.png',
    })
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('operation must be resize or optimize')
  })
})

describe('detail selector flags', () => {
  it.each([
    ['flows', 'list', '--slug', ''],
    ['automations', 'runs', 'list', '--run', ''],
    ['analytics', 'sends', 'list', '--send', ''],
    ['analytics', 'trigger-instances', 'list', '--trigger-instance', ''],
    ['automations', 'audience-runs', 'list', '--audience-run-id', ''],
    ['automations', 'triggers', 'list', '--trigger', ''],
    ['emails', 'get-inbox-placement-results', 'eml_1', '--test-id', ''],
    ['emails', 'comments', 'list', 'eml_1', '--comment-id', ''],
  ])('rejects an empty detail selector: %j', async (...argv) => {
    let requests = 0
    server.use(
      http.get('*', () => {
        requests += 1
        return HttpResponse.json({
          data: [],
          pagination: { cursor: null, hasMore: false },
        })
      })
    )
    const result = await cli(argv)
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('must not be empty')
    expect(requests).toBe(0)
  })
})

describe.each(['inline', 'stdin'])('%s JSON interpretation', (source) => {
  function inputArgs(input: unknown) {
    return ['--input', source === 'stdin' ? '-' : JSON.stringify(input)]
  }

  it.each([
    { email: 'jane@example.com', example: { label: 'Demo' }, orderTotal: 9.5 },
    { email: 'jane@example.com', example: 'Demo', subjectKind: 'order' },
    { email: 'jane@example.com', example: null },
  ])('infers the whole raw example %j', async (input) => {
    let sent: unknown
    server.use(
      http.post(`${API}/payload-contracts/infer`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ fields: [], issues: [] })
      })
    )
    const result = await cli(
      ['contracts', 'infer', ...inputArgs(input)],
      JSON.stringify(input)
    )
    expect(result.code).toBe(0)
    expect(sent).toEqual({ example: input })
  })

  it('supports explicitly nested example data and request metadata', async () => {
    const input = {
      example: { example: { label: 'Demo' }, subjectKind: 'order' },
      subjectKind: 'trigger',
    }
    let sent: unknown
    server.use(
      http.post(`${API}/payload-contracts/infer`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ fields: [], issues: [] })
      })
    )
    const result = await cli(
      ['contracts', 'infer', ...inputArgs(input)],
      JSON.stringify(input)
    )
    expect(result.code).toBe(0)
    expect(sent).toEqual(input)
  })

  it.each([
    { email: 'jane@example.com', payload: { source: 'web' }, code: '123456' },
    { payload: 'data', enforcement: 'data', other: true },
    { payload: null, other: true },
    {
      triggerEventId: 'application-field',
      payload: { email: 'jane@example.com' },
      enforcement: 'data',
    },
  ])('validates the whole raw payload %j', async (input) => {
    let sent: unknown
    server.use(
      http.post(
        `${API}/automations/triggers/tri_1/contract/validate`,
        async ({ request }) => {
          sent = await request.json()
          return HttpResponse.json({ valid: false, errors: [], warnings: [] })
        }
      )
    )
    const result = await cli(
      [
        'automations',
        'triggers',
        'contract',
        'validate',
        'tri_1',
        ...inputArgs(input),
        '--enforcement',
        'prune',
      ],
      JSON.stringify(input)
    )
    expect(result.code).toBe(0)
    expect(sent).toEqual({ payload: input, enforcement: 'prune' })
  })

  it('keeps a malformed canonical payload for API validation', async () => {
    const input = { payload: null, enforcement: 'strict' }
    let sent: unknown
    server.use(
      http.post(
        `${API}/automations/triggers/tri_1/contract/validate`,
        async ({ request }) => {
          sent = await request.json()
          return HttpResponse.json(
            {
              error: {
                code: 'INVALID_REQUEST',
                type: 'invalid_request_error',
                message: 'payload must be an object',
              },
            },
            { status: 400 }
          )
        }
      )
    )
    const result = await cli(
      [
        'automations',
        'triggers',
        'contract',
        'validate',
        'tri_1',
        ...inputArgs(input),
      ],
      JSON.stringify(input)
    )
    expect(sent).toEqual(input)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('payload must be an object')
  })

  it('uses an explicit outer wrapper for payload-only application data', async () => {
    const input = { payload: { payload: { email: 'jane@example.com' } } }
    let sent: unknown
    server.use(
      http.post(
        `${API}/automations/triggers/tri_1/contract/validate`,
        async ({ request }) => {
          sent = await request.json()
          return HttpResponse.json({ valid: false, errors: [], warnings: [] })
        }
      )
    )
    const result = await cli(
      [
        'automations',
        'triggers',
        'contract',
        'validate',
        'tri_1',
        ...inputArgs(input),
      ],
      JSON.stringify(input)
    )
    expect(result.code).toBe(0)
    expect(sent).toEqual(input)
  })
})
