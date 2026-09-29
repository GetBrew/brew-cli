import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

/**
 * Flags 0.8.1 promised "when the CLI adopts SDK 11": the list `search`
 * filter and the audience membership edit by address. SDK 10 could not send
 * them.
 */

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const API = 'https://brew.new/api'
const EMPTY_PAGE = {
  data: [],
  pagination: { limit: 100, cursor: null, hasMore: false },
}

function env(): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    BREW_API_KEY: KEY,
  }
}

describe('--search on list commands', () => {
  it.each([
    ['emails', `${API}/v1/emails`],
    ['automations', `${API}/v1/automations`],
    ['audiences', `${API}/v1/audiences`],
  ])('%s list --search sends search', async (resource, url) => {
    let seen: URL | undefined
    server.use(
      http.get(url, ({ request }) => {
        seen = new URL(request.url)
        return HttpResponse.json(EMPTY_PAGE)
      })
    )
    const result = await runCli([resource, 'list', '--search', 'welcome'], {
      env: env(),
    })
    expect(result.code).toBe(0)
    expect(seen?.searchParams.get('search')).toBe('welcome')
  })
})

describe('audiences update membership by email', () => {
  it('sends addEmails and removeEmails', async () => {
    let body: unknown
    server.use(
      http.patch(`${API}/v1/audiences/aud_1`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ audienceId: 'aud_1', name: 'VIP' })
      })
    )
    const result = await runCli(
      [
        'audiences',
        'update',
        'aud_1',
        '--add-email',
        'ada@example.com',
        '--add-email',
        'bo@example.com',
        '--remove-email',
        'cy@example.com',
      ],
      { env: env() }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({
      addEmails: ['ada@example.com', 'bo@example.com'],
      removeEmails: ['cy@example.com'],
    })
  })
})
