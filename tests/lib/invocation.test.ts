import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { buildConfirmCommand, buildRetryCommand } from '../../src/lib/confirm'
import { CliInterruptError } from '../../src/lib/errors'
import { IDEMPOTENCY_FLAG } from '../../src/lib/input'
import { getInvocationPrefix } from '../../src/lib/invocation'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const LAUNCHER = 'npx -y brew.new@0.18.0'
const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'

function env(
  extra: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    ...extra,
  }
}

describe('getInvocationPrefix', () => {
  it('defaults to brew-cli', () => {
    expect(getInvocationPrefix({})).toBe('brew-cli')
    expect(getInvocationPrefix({ BREW_CLI_INVOKED_AS: '' })).toBe('brew-cli')
    expect(getInvocationPrefix({ BREW_CLI_INVOKED_AS: '   ' })).toBe('brew-cli')
  })

  it('uses the launcher a wrapper package sets', () => {
    expect(getInvocationPrefix({ BREW_CLI_INVOKED_AS: LAUNCHER })).toBe(
      LAUNCHER
    )
    expect(
      getInvocationPrefix({ BREW_CLI_INVOKED_AS: '  pnpm   dlx  brew.new ' })
    ).toBe('pnpm dlx brew.new')
    expect(
      getInvocationPrefix({
        BREW_CLI_INVOKED_AS: 'npx -y @brew.new/cli@0.16.0',
      })
    ).toBe('npx -y @brew.new/cli@0.16.0')
  })

  it('refuses anything that is not plain shell words', () => {
    for (const unsafe of [
      'npx brew.new; rm -rf ~',
      'npx $(whoami)',
      "npx 'brew.new'",
      'npx\nbrew.new',
      'npx\tbrew.new',
      'npx `id`',
      'x'.repeat(201),
    ]) {
      expect(getInvocationPrefix({ BREW_CLI_INVOKED_AS: unsafe })).toBe(
        'brew-cli'
      )
    }
  })

  it('leads confirm and retry commands', () => {
    const remove = {
      path: ['contacts', 'delete'],
      args: [{ name: 'email', summary: 'Contact email', isRequired: true }],
    }
    const invocation = { args: { email: 'a@x.com' }, flags: {} }
    expect(buildConfirmCommand(invocation, remove, undefined, LAUNCHER)).toBe(
      `${LAUNCHER} contacts delete --yes -- a@x.com`
    )
    expect(
      buildRetryCommand(
        { args: {}, flags: {} },
        'k1',
        { path: ['emails', 'generate'], flags: [IDEMPOTENCY_FLAG] },
        LAUNCHER
      )
    ).toBe(`${LAUNCHER} emails generate --idempotency-key=k1`)
    expect(buildConfirmCommand(invocation, remove)).toBe(
      'brew-cli contacts delete --yes -- a@x.com'
    )
  })
})

describe('invocation prefix in envelopes', () => {
  it('prints the launcher in the exit-4 confirmation envelope', async () => {
    const result = await runCli(
      ['--api-key', KEY, 'contacts', 'delete', 'jane@example.com'],
      { env: env({ BREW_CLI_INVOKED_AS: LAUNCHER }) }
    )
    expect(result.code).toBe(4)
    expect(result.json).toMatchObject({
      confirmationRequired: true,
      command: `${LAUNCHER} contacts delete`,
      confirmCommand: `${LAUNCHER} contacts delete --yes -- jane@example.com`,
    })
    expect(result.stdout).not.toContain(KEY)
  })

  it('prints the launcher in an interrupted write retryCommand', async () => {
    const controller = new AbortController()
    let sentKey: string | null = null
    server.use(
      http.post('https://brew.new/api/v1/emails', ({ request }) => {
        sentKey = request.headers.get('idempotency-key')
        controller.abort(new CliInterruptError('SIGINT'))
        return new Promise<Response>(() => undefined)
      })
    )
    const result = await runCli(['emails', 'generate', '--prompt', 'Hi'], {
      env: env({ BREW_API_KEY: KEY, BREW_CLI_INVOKED_AS: LAUNCHER }),
      signal: controller.signal,
    })
    expect(result.code).toBe(130)
    const line = result.stderr.trim().split('\n').at(-1) ?? ''
    const error = (JSON.parse(line) as { error: { retryCommand: string } })
      .error
    expect(error.retryCommand).toBe(
      `${LAUNCHER} emails generate --prompt=Hi --idempotency-key=${String(sentKey)}`
    )
  })

  it('names the launcher in run-next hints (missing key)', async () => {
    const result = await runCli(['usage'], {
      env: env({ BREW_CLI_INVOKED_AS: LAUNCHER }),
    })
    expect(result.code).toBe(3)
    expect(JSON.parse(result.stderr).error.suggestion).toContain(
      `Run \`${LAUNCHER} login\``
    )
  })

  it('names the launcher in usage-error hints', async () => {
    const result = await runCli(['config', 'set', 'apiKey', 'x'], {
      env: env({ BREW_CLI_INVOKED_AS: LAUNCHER }),
    })
    expect(result.code).toBe(2)
    expect(JSON.parse(result.stderr).error.message).toBe(
      `The API key is managed by \`${LAUNCHER} login\` / \`${LAUNCHER} logout\`.`
    )
  })
})
