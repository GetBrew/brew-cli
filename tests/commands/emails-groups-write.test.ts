import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { emailsGroupsCreateCommand } from '../../src/commands/emails/groups/create'
import { emailsGroupsUpdateCommand } from '../../src/commands/emails/groups/update'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

/**
 * Group writes move designs in (GetBrew/brew-v2#1814): `--email-ids` (up to
 * 50, comma-separated) on create and update, and an update may move designs
 * without renaming the folder.
 */

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const EMAIL_GROUPS_URL = 'https://brew.new/api/v1/email-groups'
const EXTRA = [emailsGroupsCreateCommand, emailsGroupsUpdateCommand]

function env(): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    BREW_API_KEY: KEY,
  }
}

describe('emails groups create', () => {
  it('creates the folder and moves --email-ids into it in one call', async () => {
    let body: unknown
    server.use(
      http.post(EMAIL_GROUPS_URL, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          {
            groupId: 'grp_new',
            groupName: 'Launches',
            emailCount: 1,
            moved: 1,
            notMoved: [{ emailId: 'eml_busy', reason: 'generating' }],
          },
          { status: 201 }
        )
      })
    )
    const result = await runCli(
      [
        'emails',
        'groups',
        'create',
        '--name',
        'Launches',
        '--email-ids',
        'eml_1, eml_busy',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ name: 'Launches', emailIds: ['eml_1', 'eml_busy'] })
    expect(result.json).toMatchObject({
      moved: 1,
      notMoved: [{ emailId: 'eml_busy', reason: 'generating' }],
    })
  })
})

describe('emails groups update', () => {
  it('moves --email-ids into a folder without renaming it', async () => {
    let body: unknown
    server.use(
      http.patch(`${EMAIL_GROUPS_URL}/grp_1`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          groupId: 'grp_1',
          groupName: 'Launches',
          emailCount: 9,
          moved: 2,
          notMoved: [],
        })
      })
    )
    const result = await runCli(
      ['emails', 'groups', 'update', 'grp_1', '--email-ids', 'eml_1,eml_2'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ emailIds: ['eml_1', 'eml_2'] })
    expect(result.json).toMatchObject({ moved: 2 })
  })

  it('still renames with --name alone', async () => {
    let body: unknown
    server.use(
      http.patch(`${EMAIL_GROUPS_URL}/grp_1`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          groupId: 'grp_1',
          groupName: 'Welcome series',
          emailCount: 3,
        })
      })
    )
    const result = await runCli(
      ['emails', 'groups', 'update', 'grp_1', '--name', 'Welcome series'],
      { env: env(), extraCommands: EXTRA }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ name: 'Welcome series' })
  })

  it('refuses an empty --email-ids list before sending, on update and create', async () => {
    let calls = 0
    server.use(
      http.patch(`${EMAIL_GROUPS_URL}/grp_1`, () => {
        calls += 1
        return HttpResponse.json({})
      }),
      http.post(EMAIL_GROUPS_URL, () => {
        calls += 1
        return HttpResponse.json({}, { status: 201 })
      })
    )
    const update = await runCli(
      ['emails', 'groups', 'update', 'grp_1', '--email-ids', ','],
      { env: env(), extraCommands: EXTRA }
    )
    expect(update.code).toBe(2)
    expect(update.stderr).toContain('--email-ids')
    // Beside a valid rename, an empty list still fails locally rather than
    // turning the rename into an API validation error.
    const rename = await runCli(
      [
        'emails',
        'groups',
        'update',
        'grp_1',
        '--name',
        'Launches',
        '--email-ids',
        ' , ',
      ],
      { env: env(), extraCommands: EXTRA }
    )
    expect(rename.code).toBe(2)
    const create = await runCli(
      ['emails', 'groups', 'create', '--name', 'Launches', '--email-ids', ','],
      { env: env(), extraCommands: EXTRA }
    )
    expect(create.code).toBe(2)
    expect(calls).toBe(0)
  })

  it('refuses an update with neither --name nor --email-ids before sending', async () => {
    let calls = 0
    server.use(
      http.patch(`${EMAIL_GROUPS_URL}/grp_1`, () => {
        calls += 1
        return HttpResponse.json({})
      })
    )
    const result = await runCli(['emails', 'groups', 'update', 'grp_1'], {
      env: env(),
      extraCommands: EXTRA,
    })
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('--name')
    expect(result.stderr).toContain('--email-ids')
    expect(calls).toBe(0)
  })
})
