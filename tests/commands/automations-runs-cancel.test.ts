import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { automationsRunsCancelCommand } from '../../src/commands/automations/runs/cancel'
import { server } from '../helpers/msw-server'
import { type RunCliResult, runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const URL = 'https://brew.new/api/v1/automations/runs/run_1/cancel'

function cli(argv: readonly string[]): Promise<RunCliResult> {
  return runCli(argv, {
    env: {
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
      BREW_API_KEY: KEY,
    },
    extraCommands: [automationsRunsCancelCommand],
  })
}

describe('automations runs cancel', () => {
  it('refuses without --yes: exit 4 and the confirmation envelope, no request', async () => {
    let calls = 0
    server.use(
      http.post(URL, () => {
        calls += 1
        return HttpResponse.json({})
      })
    )
    const result = await cli(['automations', 'runs', 'cancel', 'run_1'])
    expect(result.code).toBe(4)
    expect(calls).toBe(0)
    const envelope = result.json as {
      confirmationRequired: boolean
      summary: string
      confirmCommand: string
    }
    expect(envelope.confirmationRequired).toBe(true)
    expect(envelope.summary).toContain('run_1')
    expect(envelope.summary).toContain('never be resumed')
    expect(envelope.confirmCommand).toContain('--yes')
  })

  it('cancels with --yes: POST the action sub-path, reason in the body', async () => {
    let capturedRequest: Request | undefined
    let capturedBody: unknown
    server.use(
      http.post(URL, async ({ request }) => {
        capturedRequest = request
        capturedBody = await request.json()
        return HttpResponse.json({
          automationRunId: 'run_1',
          status: 'canceled',
          previousStatus: 'running',
        })
      })
    )
    const result = await cli([
      'automations',
      'runs',
      'cancel',
      'run_1',
      '--reason',
      'wrong audience',
      '--yes',
    ])
    expect(result.code).toBe(0)
    expect(capturedRequest?.method).toBe('POST')
    expect(capturedBody).toEqual({ reason: 'wrong audience' })
    expect(result.json).toEqual({
      automationRunId: 'run_1',
      status: 'canceled',
      previousStatus: 'running',
    })
  })

  it('omits reason from the body when the flag is absent', async () => {
    let capturedBody: unknown
    server.use(
      http.post(URL, async ({ request }) => {
        capturedBody = await request.text()
        return HttpResponse.json({
          automationRunId: 'run_1',
          status: 'canceled',
          previousStatus: 'queued',
        })
      })
    )
    const result = await cli([
      'automations',
      'runs',
      'cancel',
      'run_1',
      '--yes',
    ])
    expect(result.code).toBe(0)
    expect(capturedBody === '' || capturedBody === '{}').toBe(true)
  })

  it('surfaces the typed 409 when the run already finished', async () => {
    server.use(
      http.post(URL, () =>
        HttpResponse.json(
          {
            // `suggestion` and `docs` are REQUIRED on the error object by the
            // spec, and the SDK's envelope parser enforces that: an envelope
            // missing either degrades to `code: 'unknown_error'`. Keep this
            // fixture shaped like the real 409 the API sends.
            error: {
              code: 'RUN_NOT_CANCELLABLE',
              type: 'conflict',
              message: 'Run run_1 already completed.',
              suggestion:
                'The run has already finished and can no longer be canceled.',
              docs: 'https://docs.brew.new/api-reference/api/errors',
            },
          },
          { status: 409 }
        )
      )
    )
    const result = await cli([
      'automations',
      'runs',
      'cancel',
      'run_1',
      '--yes',
    ])
    expect(result.code).toBe(1)
    const body = JSON.parse(result.stderr) as { error: { code: string } }
    expect(body.error.code).toBe('RUN_NOT_CANCELLABLE')
  })
})
