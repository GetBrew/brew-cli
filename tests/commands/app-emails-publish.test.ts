import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { type RunCliOptions, runCli } from '../helpers/run-cli'

/**
 * `app-emails upsert` and an email unpublished in Brew: a re-run leaves it
 * off (`APP_EMAIL_NOT_PUBLISHED`), and only `publish: true` turns it back on.
 */

function cli(argv: readonly string[], options: RunCliOptions = {}) {
  return runCli(argv, {
    ...options,
    env: {
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
      BREW_API_KEY: 'brew_abcdefghijklmnopqrstuvwxyz012345',
    },
  })
}

const URL = 'https://brew.new/api/v1/app-emails/order.paid'

const NOT_PUBLISHED = {
  code: 'APP_EMAIL_NOT_PUBLISHED',
  message:
    '"order.paid" was unpublished in Brew after setup, so the setup left it unpublished. Publish it in Brew, or run PUT /v1/app-emails/order.paid with `publish: true`.',
}

function setup(published: boolean, warnings: Array<typeof NOT_PUBLISHED>) {
  return {
    triggerKey: 'order.paid',
    published,
    created: { trigger: false, email: false, automation: false },
    sender: { mode: 'domain', from: 'hello@acme.com' },
    warnings,
  }
}

describe('app-emails upsert --publish', () => {
  it('sends publish: true, which turns an email unpublished in Brew back on', async () => {
    let body: unknown
    server.use(
      http.put(URL, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(setup(true, []))
      })
    )
    const result = await cli(
      ['app-emails', 'upsert', 'order.paid', '--publish', '--yes'],
      { ttyOut: true }
    )
    expect(result.code).toBe(0)
    expect(body).toEqual({ publish: true })
    expect(result.stdout).toContain('order.paid: published; sender')
  })

  it('leaves publish out without a flag and prints APP_EMAIL_NOT_PUBLISHED', async () => {
    let body: unknown
    server.use(
      http.put(URL, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(setup(false, [NOT_PUBLISHED]))
      })
    )
    const result = await cli(['app-emails', 'upsert', 'order.paid', '--yes'], {
      ttyOut: true,
    })
    expect(result.code).toBe(0)
    expect(body).toEqual({})
    const lines = result.stdout.trimEnd().split('\n')
    expect(lines[0]).toBe(
      'order.paid: saved, not published; sender hello@acme.com.'
    )
    expect(lines).toContain(`warning: ${NOT_PUBLISHED.message}`)
  })

  it('keeps --publish and --no-publish in the confirmation command', async () => {
    const publish = await cli([
      'app-emails',
      'upsert',
      'order.paid',
      '--publish',
    ])
    expect(publish.code).toBe(4)
    expect((publish.json as { confirmCommand: string }).confirmCommand).toBe(
      'brew-cli app-emails upsert --publish --yes -- order.paid'
    )
    const keepOff = await cli([
      'app-emails',
      'upsert',
      'order.paid',
      '--no-publish',
      '--overwrite',
    ])
    expect(keepOff.code).toBe(4)
    expect((keepOff.json as { confirmCommand: string }).confirmCommand).toBe(
      'brew-cli app-emails upsert --no-publish --overwrite --yes -- order.paid'
    )
  })

  it('confirms --publish over an inline publish: false, since the flag wins', async () => {
    const result = await cli([
      'app-emails',
      'upsert',
      'order.paid',
      '--publish',
      '--input',
      '{"publish":false}',
    ])
    expect(result.code).toBe(4)
    expect((result.json as { summary: string }).summary).toContain('publish it')
  })
})
