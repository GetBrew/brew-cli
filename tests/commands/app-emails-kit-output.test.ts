import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

/** `app-emails kit` on a terminal: what a person reads about each key. */

const DRAFT_WARNING = {
  code: 'DRAFT_SAVED_NOT_LIVE',
  message:
    'The new version is a draft: the published version keeps sending until you publish it.',
}

describe('app-emails kit terminal output', () => {
  it('names a key whose published version keeps sending, with its warning', async () => {
    server.use(
      http.post('https://brew.new/api/v1/app-emails/kit', () =>
        HttpResponse.json({
          results: [
            {
              ok: true,
              triggerKey: 'lifecycle.welcome',
              published: false,
              sender: { mode: 'sandbox' },
              warnings: [DRAFT_WARNING],
            },
          ],
          stack: {
            provider: 'custom',
            authDelivery: 'code',
            note: 'Send from your code.',
            keys: [],
            snippets: [],
          },
        })
      )
    )
    const result = await runCli(
      ['app-emails', 'kit', '--sets', 'lifecycle', '--yes'],
      {
        ttyOut: true,
        env: {
          BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
          BREW_API_KEY: 'brew_abcdefghijklmnopqrstuvwxyz012345',
        },
      }
    )
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('draft saved, published version sends')
    expect(result.stdout).toContain(
      `lifecycle.welcome: warning: ${DRAFT_WARNING.message}`
    )
  })
})
