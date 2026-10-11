import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { automationsTestCommand } from '../../src/commands/automations/test'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const API = 'https://brew.new/api/v1/automations/am_1/test'
const scenario = { splits: [{ nodeId: 'split_1', branch: 'left' }] }

function cli(
  input: unknown,
  options: { yes?: boolean; stdin?: boolean; idempotencyKey?: string } = {}
) {
  const json = JSON.stringify(input)
  return runCli(
    [
      'automations',
      'test',
      'am_1',
      '--input',
      options.stdin === true ? '-' : json,
      ...(options.yes === true ? ['--yes'] : []),
      ...(options.idempotencyKey === undefined
        ? []
        : ['--idempotency-key', options.idempotencyKey]),
    ],
    {
      env: {
        BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
        BREW_API_KEY: 'brew_abcdefghijklmnopqrstuvwxyz012345',
      },
      ...(options.stdin === true ? { stdin: json } : {}),
      extraCommands: [automationsTestCommand],
    }
  )
}

function observeRequests() {
  const bodies: unknown[] = []
  server.use(
    http.post(API, async ({ request }) => {
      bodies.push(await request.json())
      return HttpResponse.json(
        { automationRunIds: ['arun_1'], status: 'test_started' },
        { status: 202 }
      )
    })
  )
  return bodies
}

describe('automation test delivery boundary', () => {
  it('forwards the explicit replay key as a request header', async () => {
    let key: string | null | undefined
    server.use(
      http.post(API, ({ request }) => {
        key = request.headers.get('Idempotency-Key')
        return HttpResponse.json({
          automationRunIds: ['arun_1'],
          status: 'test_started',
        })
      })
    )
    const result = await cli({}, { idempotencyKey: 'automation-test-retry' })
    expect(result.code).toBe(0)
    expect(key).toBe('automation-test-retry')
  })

  it.each([
    { testRecipient: 'qa@example.com' },
    { testRecipient: 'qa@example.com', scenario },
    {
      payload: { email: 'contact@example.com' },
      testRecipient: 'qa@example.com',
      scenario,
    },
  ])('preserves API request fields with --yes: %j', async (input) => {
    const bodies = observeRequests()
    const result = await cli(input, { yes: true })
    expect(result.code).toBe(0)
    expect(bodies).toEqual([input])
  })

  it.each([false, true])(
    'requires confirmation before real test delivery (stdin=%s)',
    async (stdin) => {
      const bodies = observeRequests()
      const result = await cli({ testRecipient: 'qa@example.com' }, { stdin })
      expect(result.code).toBe(4)
      expect(result.json).toMatchObject({ confirmationRequired: true })
      expect(bodies).toEqual([])
    }
  )

  it.each([false, true])(
    'runs a scenario dry run without confirmation (stdin=%s)',
    async (stdin) => {
      const bodies = observeRequests()
      const input = { scenario }
      const result = await cli(input, { stdin })
      expect(result.code).toBe(0)
      expect(bodies).toEqual([input])
    }
  )

  it('delivers an explicit stdin test request with --yes', async () => {
    const bodies = observeRequests()
    const input = {
      testRecipient: 'qa@example.com',
      payload: { userId: 'u_1' },
    }
    const result = await cli(input, { stdin: true, yes: true })
    expect(result.code).toBe(0)
    expect(bodies).toEqual([input])
  })

  it('keeps a nested testRecipient in trigger payload as a dry run', async () => {
    const bodies = observeRequests()
    const input = { payload: { testRecipient: 'contact@example.com' } }
    const result = await cli(input)
    expect(result.code).toBe(0)
    expect(bodies).toEqual([input])
  })
})
