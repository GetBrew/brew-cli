import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { emailsDeleteCommand } from '../../src/commands/emails/delete'
import { emailsEditCommand } from '../../src/commands/emails/edit'
import { emailsGenerateCommand } from '../../src/commands/emails/generate'
import { emailsGetCommand } from '../../src/commands/emails/get'
import { emailsGroupsListCommand } from '../../src/commands/emails/groups/list'
import { emailsImportCommand } from '../../src/commands/emails/import'
import { emailsListCommand } from '../../src/commands/emails/list'
import { emailsRestoreCommand } from '../../src/commands/emails/restore'
import { emailsSendCommand } from '../../src/commands/emails/send'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'

const EXTRA = [
  emailsListCommand,
  emailsGroupsListCommand,
  emailsGetCommand,
  emailsGenerateCommand,
  emailsImportCommand,
  emailsEditCommand,
  emailsRestoreCommand,
  emailsDeleteCommand,
  emailsSendCommand,
]

function env(): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    BREW_API_KEY: KEY,
  }
}

const EMAILS_URL = 'https://brew.new/api/v1/emails'
const EMAIL_GROUPS_URL = 'https://brew.new/api/v1/email-groups'
const SENDS_URL = 'https://brew.new/api/v1/sends'
const PAGE = { limit: 100, cursor: null, hasMore: false }

describe('emails list', () => {
  it('maps flags onto query parameters', async () => {
    let url: URL | undefined
    server.use(
      http.get(EMAILS_URL, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          data: [
            {
              emailId: 'eml_1',
              title: 'Fall sale',
              status: 'complete',
              updatedAt: '2026-08-01T00:00:00Z',
            },
          ],
          pagination: PAGE,
        })
      })
    )
    const result = await runCli(
      [
        'emails',
        'list',
        '--status',
        'complete',
        '--group-id',
        'grp_lifecycle',
        '--sort',
        'title',
        '--order',
        'asc',
        '--limit',
        '10',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('status')).toBe('complete')
    expect(url?.searchParams.get('groupId')).toBe('grp_lifecycle')
    expect(url?.searchParams.get('sort')).toBe('title')
    expect(url?.searchParams.get('order')).toBe('asc')
    expect(url?.searchParams.get('limit')).toBe('10')
    const data = result.json as { data: Array<{ emailId: string }> }
    expect(data.data[0]?.emailId).toBe('eml_1')
  })

  it('drains every page with --all', async () => {
    const cursors: Array<string | null> = []
    server.use(
      http.get(EMAILS_URL, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        cursors.push(cursor)
        return HttpResponse.json(
          cursor === null
            ? {
                data: [{ emailId: 'eml_1' }],
                pagination: { limit: 1, cursor: 'c1', hasMore: true },
              }
            : {
                data: [{ emailId: 'eml_2' }],
                pagination: { limit: 1, cursor: null, hasMore: false },
              }
        )
      })
    )
    const result = await runCli(['emails', 'list', '--all'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect(cursors).toEqual([null, 'c1'])
    const data = result.json as { data: unknown[]; pagination: unknown }
    expect(data.data).toHaveLength(2)
    expect(data.pagination).toEqual({ cursor: null, hasMore: false })
  })
})

describe('emails groups list', () => {
  it('drains every group page with --all', async () => {
    const cursors: Array<string | null> = []
    server.use(
      http.get(EMAIL_GROUPS_URL, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        cursors.push(cursor)
        return HttpResponse.json(
          cursor === null
            ? {
                data: [{ groupId: 'grp_lifecycle', groupName: 'Lifecycle' }],
                pagination: { limit: 1, cursor: 'c1', hasMore: true },
              }
            : {
                data: [{ groupId: 'ungrouped', groupName: 'Ungrouped' }],
                pagination: { limit: 1, cursor: null, hasMore: false },
              }
        )
      })
    )

    const result = await runCli(['emails', 'groups', 'list', '--all'], {
      env: env(),
      extraCommands: EXTRA,
    })

    expect(result.code).toBe(0)
    expect(cursors).toEqual([null, 'c1'])
    const data = result.json as {
      data: Array<{ groupId: string }>
      pagination: unknown
    }
    expect(data.data.map((group) => group.groupId)).toEqual([
      'grp_lifecycle',
      'ungrouped',
    ])
    expect(data.pagination).toEqual({ cursor: null, hasMore: false })
  })
})

describe('emails get (derived)', () => {
  it('fetches one design as a single-row page', async () => {
    let url: URL | undefined
    server.use(
      http.get(EMAILS_URL, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          data: [
            {
              emailId: 'eml_1',
              title: 'Fall sale',
              status: 'complete',
              html: '<html></html>',
            },
          ],
          pagination: PAGE,
        })
      })
    )
    const result = await runCli(
      ['emails', 'get', 'eml_1', '--include', 'html,versions'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(url?.searchParams.get('emailId')).toBe('eml_1')
    expect(url?.searchParams.get('include')).toBe('html,versions')
    expect((result.json as { emailId: string }).emailId).toBe('eml_1')
  })

  it('exits 1 with EMAIL_NOT_FOUND when missing', async () => {
    server.use(
      http.get(EMAILS_URL, () =>
        HttpResponse.json({ data: [], pagination: PAGE })
      )
    )
    const result = await runCli(['emails', 'get', 'eml_ghost'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(1)
    const parsed = JSON.parse(result.stderr) as { error: { code: string } }
    expect(parsed.error.code).toBe('EMAIL_NOT_FOUND')
  })
})

describe('emails generate', () => {
  it('posts the prompt and prints a heartbeat', async () => {
    let body: unknown
    server.use(
      http.post(EMAILS_URL, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          { emailId: 'eml_new', status: 'complete' },
          { status: 201 }
        )
      })
    )
    const result = await runCli(
      [
        'emails',
        'generate',
        '--prompt',
        'Fall launch email',
        '--group-id',
        'grp_launches',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({
      prompt: 'Fall launch email',
      groupId: 'grp_launches',
    })
    expect(result.stderr).toContain('Generating email')
  })

  it('sends --subject-line as subjectLine', async () => {
    let body: unknown
    server.use(
      http.post(EMAILS_URL, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          { emailId: 'eml_new', status: 'complete' },
          { status: 201 }
        )
      })
    )
    const result = await runCli(
      [
        'emails',
        'generate',
        '--prompt',
        'Fall launch email',
        '--subject-line',
        'Fall arrivals are here',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({
      prompt: 'Fall launch email',
      subjectLine: 'Fall arrivals are here',
    })
  })

  it('requires a prompt', async () => {
    const result = await runCli(['emails', 'generate'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(2)
  })
})

describe('emails import', () => {
  it('reads --file and posts the typed body', async () => {
    let body: unknown
    server.use(
      http.post(`${EMAILS_URL}/import`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ emailId: 'eml_imp' }, { status: 201 })
      })
    )
    const dir = mkdtempSync(join(tmpdir(), 'brew-cli-import-'))
    const filePath = join(dir, 'legacy.html')
    writeFileSync(filePath, '<html><body>Hi</body></html>')
    const result = await runCli(
      [
        'emails',
        'import',
        '--file',
        filePath,
        '--format',
        'html',
        '--title',
        'Legacy',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({
      format: 'html',
      content: '<html><body>Hi</body></html>',
      title: 'Legacy',
    })
  })

  it('sends --subject-line as subjectLine', async () => {
    let body: unknown
    server.use(
      http.post(`${EMAILS_URL}/import`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ emailId: 'eml_imp' }, { status: 201 })
      })
    )
    const dir = mkdtempSync(join(tmpdir(), 'brew-cli-import-'))
    const filePath = join(dir, 'legacy.html')
    writeFileSync(filePath, '<html><body>Hi</body></html>')
    const result = await runCli(
      [
        'emails',
        'import',
        '--file',
        filePath,
        '--format',
        'html',
        '--subject-line',
        'This month at Brew',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toMatchObject({ subjectLine: 'This month at Brew' })
  })
})

describe('emails edit', () => {
  it('patches the design with the prompt', async () => {
    let body: unknown
    server.use(
      http.patch(`${EMAILS_URL}/eml_1`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ emailId: 'eml_1', status: 'complete' })
      })
    )
    const result = await runCli(
      ['emails', 'edit', 'eml_1', '--prompt', 'Tighten the hero copy'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ prompt: 'Tighten the hero copy' })
    expect(result.stderr).toContain('Editing email')
  })

  it('patches subject-only without an AI prompt (no generation heartbeat)', async () => {
    let body: unknown
    server.use(
      http.patch(`${EMAILS_URL}/eml_1`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ emailId: 'eml_1', status: 'complete' })
      })
    )
    const result = await runCli(
      ['emails', 'edit', 'eml_1', '--subject-line', 'Your September roundup'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ subjectLine: 'Your September roundup' })
    // Subject-only skips the agent server-side, so promising a 30-90s edit
    // would be a lie.
    expect(result.stderr).toContain('Setting the subject line')
    expect(result.stderr).not.toContain('Editing email')
  })

  it('sends both when a prompt and a subject line are given', async () => {
    let body: unknown
    server.use(
      http.patch(`${EMAILS_URL}/eml_1`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ emailId: 'eml_1', status: 'complete' })
      })
    )
    const result = await runCli(
      [
        'emails',
        'edit',
        'eml_1',
        '--prompt',
        'Tighten the hero copy',
        '--subject-line',
        'Fall arrivals are here',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({
      prompt: 'Tighten the hero copy',
      subjectLine: 'Fall arrivals are here',
    })
    expect(result.stderr).toContain('Editing email')
  })

  it('requires a prompt or a subject line (or --input)', async () => {
    const result = await runCli(['emails', 'edit', 'eml_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(2)
  })
})

describe('emails restore', () => {
  it('posts the version to restore', async () => {
    let body: unknown
    server.use(
      http.post(`${EMAILS_URL}/eml_1/restore`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ emailId: 'eml_1', version: 4 })
      })
    )
    const result = await runCli(
      ['emails', 'restore', 'eml_1', '--to-version', '2'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ version: 2 })
  })

  it('requires --to-version', async () => {
    const result = await runCli(['emails', 'restore', 'eml_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(2)
  })
})

describe('emails delete (confirmation protocol)', () => {
  it('exits 4 with an envelope when unconfirmed', async () => {
    const result = await runCli(['emails', 'delete', 'eml_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(4)
    const envelope = result.json as Record<string, unknown>
    expect(envelope.confirmationRequired).toBe(true)
    expect(envelope.summary).toContain('eml_1')
    expect(envelope.confirmCommand).toBe('brew-cli emails delete eml_1 --yes')
  })

  it('deletes with --yes', async () => {
    server.use(
      http.delete(`${EMAILS_URL}/eml_1`, () =>
        HttpResponse.json({ emailId: 'eml_1', deleted: true })
      )
    )
    const result = await runCli(['emails', 'delete', 'eml_1', '--yes'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(0)
    expect((result.json as { deleted: boolean }).deleted).toBe(true)
  })
})

describe('emails send', () => {
  it('sends a test without any confirmation gate', async () => {
    let body: unknown
    server.use(
      http.post(SENDS_URL, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          { sendId: 'snd_test', status: 'sent' },
          { status: 201 }
        )
      })
    )
    const result = await runCli(
      [
        'emails',
        'send',
        'eml_1',
        '--test',
        '--to',
        'qa@example.com',
        '--subject',
        'Preview',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({
      emailId: 'eml_1',
      test: true,
      subject: 'Preview',
      to: 'qa@example.com',
    })
  })

  it('gates a campaign send without --yes', async () => {
    const result = await runCli(
      [
        'emails',
        'send',
        'eml_1',
        '--subject',
        'Fall sale',
        '--domain',
        'dom_1',
        '--audience',
        'aud_1',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(4)
    const envelope = result.json as {
      confirmationRequired: boolean
      summary: string
    }
    expect(envelope.confirmationRequired).toBe(true)
    expect(envelope.summary).toContain('eml_1')
    expect(envelope.summary).toContain('aud_1')
  })

  it('posts the campaign body with --yes', async () => {
    let body: unknown
    server.use(
      http.post(SENDS_URL, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          { sendId: 'snd_1', status: 'scheduled' },
          { status: 201 }
        )
      })
    )
    const result = await runCli(
      [
        'emails',
        'send',
        'eml_1',
        '--subject',
        'Fall sale',
        '--domain',
        'dom_1',
        '--audience',
        'aud_1',
        '--schedule-at',
        '2026-09-01T09:00:00Z',
        '--yes',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({
      emailId: 'eml_1',
      subject: 'Fall sale',
      domainId: 'dom_1',
      audienceId: 'aud_1',
      scheduledAt: '2026-09-01T09:00:00Z',
    })
  })

  it('requires --domain for a campaign send', async () => {
    const result = await runCli(
      ['emails', 'send', 'eml_1', '--subject', 'Fall sale', '--yes'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(2)
  })
})

describe('emails send with --input bodies (gate awareness)', () => {
  it('skips the gate when --input carries test:true, and it reaches the wire', async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.post(SENDS_URL, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ status: 'sent', recipient: 'qa@x.com' })
      })
    )
    const result = await runCli(
      [
        'emails',
        'send',
        'eml_1',
        '--input',
        '{"test":true,"to":"qa@x.com","subject":"Preview"}',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body?.test).toBe(true)
    expect(body?.to).toBe('qa@x.com')
  })

  it('names the --input audience and schedule in the confirmation summary', async () => {
    const result = await runCli(
      [
        'emails',
        'send',
        'eml_1',
        '--subject',
        'Fall sale',
        '--domain',
        'dom_1',
        '--input',
        '{"audienceId":"aud_9","scheduledAt":"2027-01-01T00:00:00Z"}',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(4)
    const summary = (result.json as { summary: string }).summary
    expect(summary).toContain('audience aud_9')
    expect(summary).toContain('at 2027-01-01T00:00:00Z')
    expect(summary).not.toContain(' now')
  })

  it('keeps test:true on the wire when --test is set against a contradicting --input', async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.post(SENDS_URL, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ status: 'sent', recipient: 'qa@x.com' })
      })
    )
    const result = await runCli(
      [
        'emails',
        'send',
        'eml_1',
        '--test',
        '--to',
        'qa@x.com',
        '--subject',
        'Preview',
        '--input',
        '{"test":false}',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body?.test).toBe(true)
  })

  it('requires --to for a --test send', async () => {
    const result = await runCli(
      ['emails', 'send', 'eml_1', '--test', '--subject', 'Preview'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(2)
  })
})

describe('--input cannot retarget the positional id', () => {
  it('pins the PATCH to the named email even when --input names another', async () => {
    let path = ''
    let body: Record<string, unknown> | undefined
    server.use(
      http.patch(`${EMAILS_URL}/eml_A`, async ({ request }) => {
        path = new URL(request.url).pathname
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ emailId: 'eml_A' })
      })
    )
    const result = await runCli(
      [
        'emails',
        'edit',
        'eml_A',
        '--input',
        '{"emailId":"eml_B","prompt":"Rewrite the hero"}',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(path).toBe('/api/v1/emails/eml_A')
    expect(body?.emailId).toBeUndefined()
  })
})

describe('idempotency key plumbing', () => {
  it('sends the exact --idempotency-key header on generate', async () => {
    let idempotency: string | null = null
    server.use(
      http.post(EMAILS_URL, ({ request }) => {
        idempotency = request.headers.get('idempotency-key')
        return HttpResponse.json({ emailId: 'eml_1' }, { status: 201 })
      })
    )
    const result = await runCli(
      [
        'emails',
        'generate',
        '--prompt',
        'Welcome email',
        '--idempotency-key',
        'idem-42',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(idempotency).toBe('idem-42')
  })
})
