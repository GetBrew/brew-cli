import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import {
  AUDIT_EMAIL_DEFAULT_TIMEOUT_MS,
  emailsAuditCommand,
} from '../../src/commands/emails/audit'
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

describe('emails audit', () => {
  it.each([
    {
      base: { emailHtml: '<p>Old</p>', subject: 'From JSON' },
      flag: '--jsx-file',
      expected: { emailJsx: '<Text>New</Text>', subject: 'From JSON' },
    },
    {
      base: {
        emailId: 'email_old',
        emailVersionId: 'version_old',
        subject: 'From JSON',
      },
      flag: '--file',
      expected: { emailHtml: '<p>New</p>', subject: 'From JSON' },
    },
    {
      base: { emailJsx: '<Text>Old</Text>', sendingPurpose: 'transactional' },
      flag: '--email-id',
      expected: { emailId: 'email_new', sendingPurpose: 'transactional' },
    },
  ])(
    'source flags replace the JSON source: $flag',
    async ({ base, flag, expected }) => {
      const directory = mkdtempSync(join(tmpdir(), 'brew-audit-source-'))
      const file = join(directory, 'content.txt')
      writeFileSync(
        file,
        flag === '--jsx-file' ? '<Text>New</Text>' : '<p>New</p>'
      )
      let body: unknown
      server.use(
        http.post(`${API}/v1/emails/audit`, async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({
            completion: { status: 'complete', readiness: 'ready', score: 100 },
          })
        })
      )
      const result = await runCli(
        [
          'emails',
          'audit',
          '--input',
          JSON.stringify(base),
          flag,
          flag === '--email-id' ? 'email_new' : file,
        ],
        {
          env: env(),
          extraCommands: [emailsAuditCommand],
        }
      )
      expect(result.code).toBe(0)
      expect(body).toEqual(expected)
    }
  )

  it('accepts a JSX file and forwards saved-email flags', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'brew-jsx-audit-'))
    const file = join(directory, 'email.tsx')
    writeFileSync(file, '<Text>Hello</Text>')
    const bodies: Array<unknown> = []
    server.use(
      http.post(`${API}/v1/emails/audit`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({
          completion: { status: 'complete', readiness: 'ready', score: 100 },
        })
      })
    )
    const jsx = await runCli(['emails', 'audit', '--jsx-file', file], {
      env: env(),
      extraCommands: [emailsAuditCommand],
    })
    const saved = await runCli(
      [
        'emails',
        'audit',
        '--email-id',
        'email_123',
        '--email-version-id',
        'version_123',
      ],
      {
        env: env(),
        extraCommands: [emailsAuditCommand],
      }
    )
    expect(jsx.code).toBe(0)
    expect(saved.code).toBe(0)
    expect(bodies).toEqual([
      { emailJsx: '<Text>Hello</Text>' },
      { emailId: 'email_123', emailVersionId: 'version_123' },
    ])
  })

  it.each([
    { emailJsx: '<Text>Hello</Text>' },
    { emailId: 'email_123' },
    { emailId: 'email_123', emailVersionId: 'version_123' },
  ])('forwards the documented content source: %j', async (input) => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/emails/audit`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          completion: { status: 'complete', readiness: 'ready', score: 100 },
        })
      })
    )
    const result = await runCli(
      ['emails', 'audit', '--input', JSON.stringify(input)],
      {
        env: env(),
        extraCommands: [emailsAuditCommand],
      }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual(input)
  })

  it.each([
    { emailHtml: '<p>Hello</p>', emailJsx: '<Text>Hello</Text>' },
    { emailHtml: '<p>Hello</p>', emailId: 'email_123' },
    { emailHtml: '<p>Hello</p>', emailVersionId: 'version_123' },
    { emailJsx: ' ' },
    { emailId: '' },
    {},
  ])(
    'rejects an invalid source combination before transport: %j',
    async (input) => {
      let requests = 0
      server.use(
        http.post(`${API}/v1/emails/audit`, () => {
          requests += 1
          return HttpResponse.json({})
        })
      )
      const result = await runCli(
        ['emails', 'audit', '--input', JSON.stringify(input)],
        {
          env: env(),
          extraCommands: [emailsAuditCommand],
        }
      )
      expect(result.code).toBe(2)
      expect(requests).toBe(0)
    }
  )

  it('audits a file with the exact copy and purpose fields', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'brew-email-audit-'))
    const file = join(directory, 'email.html')
    writeFileSync(file, '<p>Hello</p>')
    let body: unknown
    let idempotencyKey: string | null = null
    server.use(
      http.post(`${API}/v1/emails/audit`, async ({ request }) => {
        body = await request.json()
        idempotencyKey = request.headers.get('idempotency-key')
        return HttpResponse.json({
          schemaVersion: 1,
          completion: { status: 'complete', readiness: 'ready', score: 100 },
        })
      })
    )

    const result = await runCli(
      [
        'emails',
        'audit',
        '--file',
        file,
        '--subject',
        'Hello',
        '--preview-text',
        '',
        '--sending-purpose',
        'marketing',
        '--idempotency-key',
        'audit-1',
      ],
      { env: env(), extraCommands: [emailsAuditCommand] }
    )

    expect(result.code).toBe(0)
    expect(body).toEqual({
      emailHtml: '<p>Hello</p>',
      subject: 'Hello',
      previewText: '',
      sendingPurpose: 'marketing',
    })
    expect(idempotencyKey).toBe('audit-1')
    // The 65 s audit deadline is the command's own whole-command default.
    expect(AUDIT_EMAIL_DEFAULT_TIMEOUT_MS).toBe(65_000)
    expect(emailsAuditCommand.defaultTimeoutMs).toBe(
      AUDIT_EMAIL_DEFAULT_TIMEOUT_MS
    )
  })

  it('accepts the full request as JSON from stdin', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/emails/audit`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          schemaVersion: 1,
          completion: {
            status: 'partial',
            readiness: 'unknown',
            score: null,
          },
        })
      })
    )

    const result = await runCli(['emails', 'audit', '--input', '-'], {
      env: env(),
      extraCommands: [emailsAuditCommand],
      stdin: JSON.stringify({
        emailHtml: '<p>Hello</p>',
        sendingPurpose: 'transactional',
      }),
    })

    expect(result.code).toBe(0)
    expect(body).toEqual({
      emailHtml: '<p>Hello</p>',
      sendingPurpose: 'transactional',
    })
  })

  it('auto-generates an idempotency key when the flag is omitted', async () => {
    let idempotencyKey: string | null = null
    server.use(
      http.post(`${API}/v1/emails/audit`, ({ request }) => {
        idempotencyKey = request.headers.get('idempotency-key')
        return HttpResponse.json({
          schemaVersion: 1,
          completion: { status: 'complete', readiness: 'ready', score: 100 },
        })
      })
    )

    const result = await runCli(
      ['emails', 'audit', '--input', '{"emailHtml":"<p>Hello</p>"}'],
      { env: env(), extraCommands: [emailsAuditCommand] }
    )

    expect(result.code).toBe(0)
    expect(idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })

  it('reports its deadline as a retryable timeout that names the replay key', async () => {
    server.use(
      http.post(
        `${API}/v1/emails/audit`,
        () => new Promise<Response>(() => undefined)
      )
    )

    const result = await runCli(
      [
        'emails',
        'audit',
        '--input',
        '{"emailHtml":"<p>Hello</p>"}',
        '--timeout',
        '150ms',
        '--idempotency-key',
        'audit-9',
      ],
      { env: env(), extraCommands: [emailsAuditCommand] }
    )

    expect(result.code).toBe(1)
    const { error } = JSON.parse(result.stderr) as {
      error: Record<string, unknown>
    }
    expect(error.code).toBe('CLI_TIMEOUT')
    expect(error.type).toBe('service_unavailable')
    expect(error.message).toBe(
      'No complete response within 150ms (POST /v1/emails/audit).'
    )
    expect(error.idempotencyKey).toBe('audit-9')
    expect(error.retryCommand).toBe(
      'brew-cli emails audit --input \'{"emailHtml":"<p>Hello</p>"}\' --timeout 150ms --idempotency-key audit-9'
    )
  })
})
