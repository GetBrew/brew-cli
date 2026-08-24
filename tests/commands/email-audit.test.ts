import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'

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
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')
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
    expect(AUDIT_EMAIL_DEFAULT_TIMEOUT_MS).toBe(65_000)
    expect(timeoutSpy).toHaveBeenCalledWith(AUDIT_EMAIL_DEFAULT_TIMEOUT_MS)
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

  it('reports the local audit deadline as a retryable timeout', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError'
      )
    )

    const result = await runCli(
      ['emails', 'audit', '--input', '{"emailHtml":"<p>Hello</p>"}'],
      { env: env(), extraCommands: [emailsAuditCommand] }
    )

    expect(result.code).toBe(1)
    expect(JSON.parse(result.stderr)).toEqual({
      error: {
        code: 'CLI_TIMEOUT',
        type: 'service_unavailable',
        message: 'The request timed out before the API responded.',
        suggestion:
          'Retry the request. Reuse the same Idempotency-Key for a POST request.',
      },
    })
  })
})
