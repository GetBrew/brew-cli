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
    // The SDK's audit deadline (above the 25 s server budget) is the
    // command's own whole-command default.
    expect(AUDIT_EMAIL_DEFAULT_TIMEOUT_MS).toBeGreaterThan(25_000)
    expect(emailsAuditCommand.defaultTimeoutMs).toBe(
      AUDIT_EMAIL_DEFAULT_TIMEOUT_MS
    )
  })

  it('audits a React Email module from --jsx and leaves the purpose to the audit', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'brew-email-audit-'))
    const file = join(directory, 'welcome.tsx')
    writeFileSync(file, '<Html><Text>Hi</Text></Html>')
    let body: unknown
    server.use(
      http.post(`${API}/v1/emails/audit`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          schemaVersion: 1,
          completion: { status: 'complete', readiness: 'ready', score: 100 },
        })
      })
    )

    const result = await runCli(
      ['emails', 'audit', '--jsx', file, '--subject', 'Welcome'],
      { env: env(), extraCommands: [emailsAuditCommand] }
    )

    expect(result.code).toBe(0)
    expect(body).toEqual({
      emailJsx: '<Html><Text>Hi</Text></Html>',
      subject: 'Welcome',
    })
  })

  it('audits a saved design version by id', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/emails/audit`, async ({ request }) => {
        body = await request.json()
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
        '--email-id',
        'email_1',
        '--email-version-id',
        'version_1',
      ],
      { env: env(), extraCommands: [emailsAuditCommand] }
    )

    expect(result.code).toBe(0)
    expect(body).toEqual({ emailId: 'email_1', emailVersionId: 'version_1' })
  })

  it.each([
    [['--input', '{"subject":"Hi"}'], 'Name the email to audit'],
    [
      ['--email-id', 'email_1', '--input', '{"emailHtml":"<p>Hi</p>"}'],
      'Audit one source at a time (got emailHtml and emailId).',
    ],
    [
      ['--input', '{"emailHtml":"<p>Hi</p>","emailVersionId":"version_1"}'],
      '--email-version-id needs --email-id.',
    ],
  ])('refuses %j before calling the API', async (args, message) => {
    const result = await runCli(['emails', 'audit', ...args], {
      env: env(),
      extraCommands: [emailsAuditCommand],
    })

    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain(message)
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
