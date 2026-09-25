import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { emailsCloneCommand } from '../../src/commands/emails/clone'
import { emailsCreateInboxPlacementTestCommand } from '../../src/commands/emails/create-inbox-placement-test'
import { emailsExportCommand } from '../../src/commands/emails/export'
import { emailsGetAuditCommand } from '../../src/commands/emails/get-audit'
import { emailsGetClientPreviewCommand } from '../../src/commands/emails/get-client-preview'
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
  emailsGetClientPreviewCommand,
  emailsGetAuditCommand,
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

describe('sends pause / resume', () => {
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
        HttpResponse.json({ sendId: 'snd_1', status: 'running' })
      )
    )
    const result = await runCli(['sends', 'resume', 'snd_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect((result.json as { status: string }).status).toBe('running')
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

  it('sends an empty object when cloning latest through the SDK', async () => {
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
    expect(text).toBe('{}')
  })
})

describe('emails export', () => {
  it('maps provider, template name, and dryRun onto the body', async () => {
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
      dryRun: true,
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

  it('sends --subject-line as subjectLine, and omits it otherwise', async () => {
    const bodies: Array<unknown> = []
    server.use(
      http.post(`${API}/v1/emails/figma`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(
          { emailId: 'eml_figma', emailVersionId: 'emv_1', format: 'jsx' },
          { status: 201 }
        )
      })
    )
    const url = 'https://www.figma.com/design/abc123/Launch?node-id=1-2'
    const withSubject = await runCli(
      [
        'emails',
        'import-figma',
        '--url',
        url,
        '--subject-line',
        'Launch day is here',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    const without = await runCli(['emails', 'import-figma', '--url', url], {
      env: env(),
      extraCommands: EXTRA,
    })

    expect(withSubject.code).toBe(0)
    expect(without.code).toBe(0)
    expect(bodies[0]).toEqual({
      figmaUrl: url,
      subjectLine: 'Launch day is here',
    })
    expect(bodies[1]).toEqual({ figmaUrl: url })
  })
})

/** A rendering job as `POST …/client-previews` and `GET …/client-previews/{previewId}` answer it. */
function renderingJob(
  status: 'queued' | 'completed',
  previews: ReadonlyArray<Record<string, unknown>>
): Record<string, unknown> {
  return {
    previewId: 'prv_1',
    emailId: 'eml_1',
    emailVersionId: 'emv_1',
    status,
    previews,
    pending: previews
      .filter((preview) => preview.status === 'running')
      .map((preview) => preview.id),
    createdAt: '2026-09-24T10:00:00.000Z',
    expiresAt: '2026-10-01T10:00:00.000Z',
    nextPollAfterMs: 5000,
    credits: { cost: 10, status: status === 'queued' ? 'reserved' : 'settled' },
  }
}

const APPLE_MAIL_RUNNING = {
  id: 'applemail16',
  label: 'Apple Mail (macOS)',
  category: 'apple',
  os: 'macOS',
  dark: false,
  status: 'running',
  imageUrl: null,
  reason: 'pending',
  retryable: true,
}

const APPLE_MAIL_DONE = {
  ...APPLE_MAIL_RUNNING,
  status: 'completed',
  imageUrl: 'https://cdn.brew.new/previews/prv_1/applemail16.png',
  reason: undefined,
  retryable: false,
}

describe('emails preview-clients', () => {
  it('sends the requested client ids in the body', async () => {
    let body: unknown
    server.use(
      http.post(
        `${API}/v1/emails/eml_1/client-previews`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json(
            renderingJob('queued', [APPLE_MAIL_RUNNING]),
            { status: 202 }
          )
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

  it('prints the admitted job and names the poll command on stderr', async () => {
    server.use(
      http.post(`${API}/v1/emails/eml_1/client-previews`, () =>
        HttpResponse.json(renderingJob('queued', [APPLE_MAIL_RUNNING]), {
          status: 202,
        })
      )
    )
    const result = await runCli(['emails', 'preview-clients', 'eml_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    const job = result.json as { previewId: string; status: string }
    expect(job.previewId).toBe('prv_1')
    expect(job.status).toBe('queued')
    // stdout stays the bare job; the next step rides stderr.
    expect(result.stderr).toContain('brew-cli emails get-client-preview prv_1')
    expect(result.stdout).not.toContain('get-client-preview')
  })

  it('skips the poll hint when the existing job has already settled', async () => {
    server.use(
      http.post(`${API}/v1/emails/eml_1/client-previews`, () =>
        HttpResponse.json(renderingJob('completed', [APPLE_MAIL_DONE]))
      )
    )
    const result = await runCli(['emails', 'preview-clients', 'eml_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect((result.json as { status: string }).status).toBe('completed')
    expect(result.stderr).not.toContain('get-client-preview')
  })
})

describe('emails get-client-preview', () => {
  it('polls the rendering job by previewId and prints it verbatim', async () => {
    let request: Request | undefined
    server.use(
      http.get(`${API}/v1/emails/client-previews/prv_1`, (info) => {
        request = info.request
        return HttpResponse.json(renderingJob('completed', [APPLE_MAIL_DONE]))
      })
    )
    const result = await runCli(['emails', 'get-client-preview', 'prv_1'], {
      env: { ...env(), BREW_BRAND_ID: 'kxbrand1' },
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect(request?.method).toBe('GET')
    expect(new URL(request?.url ?? '').pathname).toBe(
      '/api/v1/emails/client-previews/prv_1'
    )
    // A brand-scoped read: the brand binding rides along.
    expect(request?.headers.get('x-brand-id')).toBe('kxbrand1')
    const job = result.json as {
      status: string
      previews: Array<{ id: string; imageUrl: string | null }>
    }
    expect(job.status).toBe('completed')
    expect(job.previews[0]?.imageUrl).toBe(
      'https://cdn.brew.new/previews/prv_1/applemail16.png'
    )
  })

  it("surfaces the API's PREVIEW_NOT_FOUND once the job has expired", async () => {
    server.use(
      http.get(`${API}/v1/emails/client-previews/prv_gone`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'PREVIEW_NOT_FOUND',
              type: 'not_found',
              message: 'No rendering job matches that id.',
            },
          },
          { status: 404 }
        )
      )
    )
    const result = await runCli(['emails', 'get-client-preview', 'prv_gone'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(1)
    const parsed = JSON.parse(result.stderr) as { error: { code: string } }
    expect(parsed.error.code).toBe('PREVIEW_NOT_FOUND')
  })
})

const AUDIT_ID = '6f1e2d3c-4b5a-4c7d-8e9f-0a1b2c3d4e5f'

describe('emails get-audit', () => {
  it('reads one page of a saved audit, mapping --limit and --cursor', async () => {
    let request: Request | undefined
    server.use(
      http.get(`${API}/v1/emails/audits/${AUDIT_ID}`, (info) => {
        request = info.request
        return HttpResponse.json({
          auditId: AUDIT_ID,
          summary: { blockers: 0, errors: 0, warnings: 2, info: 0, total: 2 },
          findings: [
            { id: 'fnd_2', ruleId: 'links.https', severity: 'warning' },
          ],
          pagination: {
            cursor: null,
            hasMore: false,
            returned: 1,
            storedFindings: 2,
          },
        })
      })
    )
    const result = await runCli(
      [
        'emails',
        'get-audit',
        AUDIT_ID,
        '--limit',
        '1',
        '--cursor',
        'cur_page2',
      ],
      { env: { ...env(), BREW_BRAND_ID: 'kxbrand1' }, extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(request?.method).toBe('GET')
    const url = new URL(request?.url ?? '')
    expect(url.pathname).toBe(`/api/v1/emails/audits/${AUDIT_ID}`)
    expect(url.searchParams.get('limit')).toBe('1')
    expect(url.searchParams.get('cursor')).toBe('cur_page2')
    expect(request?.headers.get('x-brand-id')).toBe('kxbrand1')
    const page = result.json as { findings: Array<{ id: string }> }
    expect(page.findings[0]?.id).toBe('fnd_2')
  })

  it('sends no paging params unless asked', async () => {
    let url: URL | undefined
    server.use(
      http.get(`${API}/v1/emails/audits/${AUDIT_ID}`, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ auditId: AUDIT_ID, findings: [] })
      })
    )
    const result = await runCli(['emails', 'get-audit', AUDIT_ID], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect(url?.search).toBe('')
  })

  it('rejects a non-integer --limit before calling the API (exit 2)', async () => {
    const result = await runCli(
      ['emails', 'get-audit', AUDIT_ID, '--limit', 'ten'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('--limit')
  })

  it("surfaces the API's AUDIT_NOT_FOUND after the seven-day retention", async () => {
    server.use(
      http.get(`${API}/v1/emails/audits/${AUDIT_ID}`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'AUDIT_NOT_FOUND',
              type: 'not_found',
              message: 'No saved audit matches that id.',
            },
          },
          { status: 404 }
        )
      )
    )
    const result = await runCli(['emails', 'get-audit', AUDIT_ID], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(1)
    const parsed = JSON.parse(result.stderr) as { error: { code: string } }
    expect(parsed.error.code).toBe('AUDIT_NOT_FOUND')
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
            { testId: 'ibp_1', status: 'queued' },
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
    expect((result.json as { status: string }).status).toBe('queued')
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
  it('lists the recent tests when --test-id is absent', async () => {
    let requestedPath: string | undefined
    server.use(
      http.get(
        `${API}/v1/emails/eml_1/inbox-placement-tests`,
        ({ request }) => {
          requestedPath = new URL(request.url).pathname
          return HttpResponse.json({
            data: [{ testId: 'ibp_1', status: 'completed' }],
            pagination: { limit: 100, cursor: null, hasMore: false },
          })
        }
      )
    )
    const result = await runCli(
      ['emails', 'get-inbox-placement-results', 'eml_1'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(requestedPath).toBe('/api/v1/emails/eml_1/inbox-placement-tests')
    const data = result.json as { data: Array<{ testId: string }> }
    expect(data.data[0]?.testId).toBe('ibp_1')
  })

  it('reads the real detail route for --test-id', async () => {
    let requestedPath: string | undefined
    server.use(
      http.get(
        `${API}/v1/emails/eml_1/inbox-placement-tests/ibp_1`,
        ({ request }) => {
          requestedPath = new URL(request.url).pathname
          return HttpResponse.json({ testId: 'ibp_1', status: 'completed' })
        }
      )
    )
    const result = await runCli(
      ['emails', 'get-inbox-placement-results', 'eml_1', '--test-id', 'ibp_1'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(requestedPath).toBe(
      '/api/v1/emails/eml_1/inbox-placement-tests/ibp_1'
    )
    expect((result.json as { status: string }).status).toBe('completed')
  })

  it('reads one test through the dedicated detail command', async () => {
    let requestedPath: string | undefined
    server.use(
      http.get(
        `${API}/v1/emails/eml_1/inbox-placement-tests/ibp_1`,
        ({ request }) => {
          requestedPath = new URL(request.url).pathname
          return HttpResponse.json({ testId: 'ibp_1', status: 'completed' })
        }
      )
    )
    const result = await runCli(
      ['emails', 'inbox-placement-tests', 'get', 'eml_1', 'ibp_1'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(requestedPath).toBe(
      '/api/v1/emails/eml_1/inbox-placement-tests/ibp_1'
    )
    expect((result.json as { testId: string }).testId).toBe('ibp_1')
  })
})
