import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { emailsAuditAccessibilityCommand } from '../../src/commands/emails/audit-accessibility'
import { emailsCloneCommand } from '../../src/commands/emails/clone'
import { emailsCreateInboxPlacementTestCommand } from '../../src/commands/emails/create-inbox-placement-test'
import { emailsExportCommand } from '../../src/commands/emails/export'
import { emailsGetInboxPlacementResultsCommand } from '../../src/commands/emails/get-inbox-placement-results'
import { emailsImportFigmaCommand } from '../../src/commands/emails/import-figma'
import { emailsPreviewClientsCommand } from '../../src/commands/emails/preview-clients'
import { sendsPauseCommand } from '../../src/commands/sends/pause'
import { sendsResumeCommand } from '../../src/commands/sends/resume'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'

const EXTRA = [
  emailsCloneCommand,
  emailsExportCommand,
  emailsImportFigmaCommand,
  emailsPreviewClientsCommand,
  emailsAuditAccessibilityCommand,
  emailsCreateInboxPlacementTestCommand,
  emailsGetInboxPlacementResultsCommand,
  sendsPauseCommand,
  sendsResumeCommand,
]

function env(): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    BREW_API_KEY: KEY,
  }
}

const API = 'https://brew.new/api'

describe('sends pause / resume (raw transport)', () => {
  it('pauses a send with POST /v1/sends/{sendId}/pause', async () => {
    server.use(
      http.post(`${API}/v1/sends/snd_1/pause`, () =>
        HttpResponse.json({ sendId: 'snd_1', status: 'paused' })
      )
    )
    const result = await runCli(['sends', 'pause', 'snd_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect((result.json as { status: string }).status).toBe('paused')
  })

  it('resumes a send with POST /v1/sends/{sendId}/resume', async () => {
    server.use(
      http.post(`${API}/v1/sends/snd_1/resume`, () =>
        HttpResponse.json({ sendId: 'snd_1', status: 'sending' })
      )
    )
    const result = await runCli(['sends', 'resume', 'snd_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect((result.json as { status: string }).status).toBe('sending')
  })
})

describe('emails clone', () => {
  it('pins the source version in the body', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/emails/eml_1/clone`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          { emailId: 'eml_2', emailVersionId: 'emv_new', html: '<html/>' },
          { status: 201 }
        )
      })
    )
    const result = await runCli(
      ['emails', 'clone', 'eml_1', '--email-version-id', 'emv_2'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ emailVersionId: 'emv_2' })
    expect((result.json as { emailId: string }).emailId).toBe('eml_2')
  })

  it('omits the body when cloning latest', async () => {
    let text: string | undefined
    server.use(
      http.post(`${API}/v1/emails/eml_1/clone`, async ({ request }) => {
        text = await request.text()
        return HttpResponse.json({ emailId: 'eml_2' }, { status: 201 })
      })
    )
    const result = await runCli(['emails', 'clone', 'eml_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect(text).toBe('')
  })
})

describe('emails export', () => {
  it('maps provider, template name, and dry_run onto the body', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/emails/eml_1/export`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ provider: 'klaviyo', dryRun: true })
      })
    )
    const result = await runCli(
      [
        'emails',
        'export',
        'eml_1',
        '--provider',
        'klaviyo',
        '--template-name',
        'Fall sale',
        '--dry-run',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({
      provider: 'klaviyo',
      templateName: 'Fall sale',
      dry_run: true,
    })
  })

  it('requires --provider', async () => {
    const result = await runCli(['emails', 'export', 'eml_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(2)
  })
})

describe('emails import-figma', () => {
  it('sends the figma url and format in the body', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/emails/figma`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          { emailId: 'eml_figma', emailVersionId: 'emv_1', format: 'html' },
          { status: 201 }
        )
      })
    )
    const url = 'https://www.figma.com/design/abc123/Launch?node-id=1-2'
    const result = await runCli(
      ['emails', 'import-figma', '--url', url, '--format', 'html'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ figmaUrl: url, format: 'html' })
  })
})

describe('emails preview-clients', () => {
  it('sends the requested client ids in the body', async () => {
    let body: unknown
    server.use(
      http.post(
        `${API}/v1/emails/eml_1/client-previews`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({
            previews: [{ client: 'applemail16', status: 'completed' }],
          })
        }
      )
    )
    const result = await runCli(
      [
        'emails',
        'preview-clients',
        'eml_1',
        '--clients',
        'applemail16',
        'iphone16_18',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ clients: ['applemail16', 'iphone16_18'] })
  })
})

describe('emails audit-accessibility', () => {
  it('issues the spec-correct POST (not GET) with the idempotency key', async () => {
    let method: string | undefined
    let idempotencyKey: string | null = null
    server.use(
      http.post(`${API}/v1/emails/eml_1/accessibility-audit`, ({ request }) => {
        method = request.method
        idempotencyKey = request.headers.get('idempotency-key')
        return HttpResponse.json({ score: 90, issues: [] })
      })
    )
    const result = await runCli(
      [
        'emails',
        'audit-accessibility',
        'eml_1',
        '--idempotency-key',
        'audit-1',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(method).toBe('POST')
    expect(idempotencyKey).toBe('audit-1')
    expect((result.json as { score: number }).score).toBe(90)
  })
})

describe('emails create-inbox-placement-test', () => {
  it('sends the placement body and surfaces the 202 pending test', async () => {
    let body: unknown
    server.use(
      http.post(
        `${API}/v1/emails/eml_1/inbox-placement-tests`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json(
            { testId: 'ibp_1', status: 'collecting' },
            { status: 202 }
          )
        }
      )
    )
    const result = await runCli(
      [
        'emails',
        'create-inbox-placement-test',
        'eml_1',
        '--domain',
        'dom_1',
        '--subject',
        'Variant B',
        '--providers',
        'gmail.com',
        'outlook.com',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({
      domainId: 'dom_1',
      subject: 'Variant B',
      providers: ['gmail.com', 'outlook.com'],
    })
    expect((result.json as { status: string }).status).toBe('collecting')
  })

  it('requires --domain', async () => {
    const result = await runCli(
      ['emails', 'create-inbox-placement-test', 'eml_1'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(2)
  })
})

describe('emails get-inbox-placement-results', () => {
  it('passes --test-id as the testId query parameter', async () => {
    let url: URL | undefined
    server.use(
      http.get(
        `${API}/v1/emails/eml_1/inbox-placement-tests`,
        ({ request }) => {
          url = new URL(request.url)
          return HttpResponse.json({ testId: 'ibp_1', status: 'completed' })
        }
      )
    )
    const result = await runCli(
      ['emails', 'get-inbox-placement-results', 'eml_1', '--test-id', 'ibp_1'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('testId')).toBe('ibp_1')
    expect((result.json as { status: string }).status).toBe('completed')
  })
})
