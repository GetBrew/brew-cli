import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import type { components } from '../../src/generated/openapi-types'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const API = 'https://brew.new/api/v1/emails'
const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'

function env(): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-recovery-')),
    BREW_API_KEY: KEY,
  }
}

describe('committed email result recovery', () => {
  it.each(['generate', 'edit'] as const)(
    'preserves a committed %s refusal and reads its saved version without repeating the write',
    async (command) => {
      let writes = 0
      let readUrl: URL | undefined
      const details = {
        committed: true,
        emailId: 'email_saved',
        emailVersionId: 'version_saved',
        runId: 'run_saved',
      }
      const suggestion =
        'Read the saved emailVersionId from error.details. Do not repeat the write.'
      const rejectCommittedResult = () => {
        writes++
        return HttpResponse.json(
          {
            error: {
              code: 'EMAIL_RESULT_UNAVAILABLE',
              type: 'conflict',
              message: 'The email was saved, but its result could not be read.',
              suggestion,
              details,
            },
          },
          { status: 409, headers: { 'x-request-id': 'request_saved' } }
        )
      }
      server.use(
        http.post(API, rejectCommittedResult),
        http.patch(`${API}/email_saved`, rejectCommittedResult),
        http.get(`${API}/email_saved`, ({ request }) => {
          readUrl = new URL(request.url)
          return HttpResponse.json({
            emailId: details.emailId,
            emailVersionId: details.emailVersionId,
            html: '<html><body>Saved</body></html>',
          })
        })
      )

      const argv = ['emails', command]
      if (command === 'edit') argv.push(details.emailId)
      const refused = await runCli(
        [...argv, '--prompt', 'Welcome', '--quiet'],
        { env: env() }
      )
      expect(refused.code).toBe(1)
      expect(refused.stdout).toBe('')
      const { error } = JSON.parse(refused.stderr) as {
        error: Record<string, unknown>
      }
      expect(error).toMatchObject({
        code: 'EMAIL_RESULT_UNAVAILABLE',
        type: 'conflict',
        status: 409,
        requestId: 'request_saved',
        suggestion,
        details,
      })
      expect(error.retryCommand).toBeUndefined()
      expect(error.idempotencyKey).toBeUndefined()

      const recovered = await runCli(
        [
          'emails',
          'get',
          details.emailId,
          '--email-version-id',
          details.emailVersionId,
          '--include',
          'html',
        ],
        { env: env() }
      )
      expect(recovered.code).toBe(0)
      expect(recovered.json).toMatchObject({
        emailId: details.emailId,
        emailVersionId: details.emailVersionId,
        html: '<html><body>Saved</body></html>',
      })
      expect(readUrl?.searchParams.get('emailVersionId')).toBe(
        details.emailVersionId
      )
      expect(readUrl?.searchParams.get('include')).toBe('html')
      expect(writes).toBe(1)
    }
  )
})

describe('email import results', () => {
  it('accepts a saved EML and preserves the complete asset report in JSON output', async () => {
    const content =
      'Subject: Welcome\r\nContent-Type: text/html\r\n\r\n<p>Hi</p>'
    let body: unknown
    const imported = {
      emailId: 'email_imported',
      emailVersionId: 'version_imported',
      html: '<html><body>Hi</body></html>',
      group: null,
      assetReport: {
        discovered: 3,
        rehosted: 1,
        retained: 1,
        stripped: 0,
        dropped: 1,
        warnings: [
          {
            code: 'fetch_failed_retained',
            location: 'src',
            host: 'example.com',
          },
          { code: 'tracking_pixel_dropped', location: 'src' },
        ],
      },
    } satisfies components['schemas']['EmailImportResponse']
    server.use(
      http.post(`${API}/import`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(imported, { status: 201 })
      })
    )

    const result = await runCli(
      ['emails', 'import', '--file', '-', '--format', 'eml'],
      { env: env(), stdin: content }
    )

    expect(result.code).toBe(0)
    expect(body).toEqual({ content, format: 'eml' })
    expect(result.json).toEqual(imported)
  })
})
