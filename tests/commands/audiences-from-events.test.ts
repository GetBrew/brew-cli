import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const URL = 'https://brew.new/api/v1/audiences/from-events'
const FROM = '2026-10-01T00:00:00Z'
const TO = '2026-10-02T00:00:00Z'

describe('audiences from-events window selection', () => {
  let bodies: unknown[]

  beforeEach(() => {
    bodies = []
    server.use(
      http.post(URL, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(
          { audienceId: 'aud_1', materializationStatus: 'pending' },
          { status: 201 }
        )
      })
    )
  })

  function cli(argv: readonly string[], stdin?: string) {
    return runCli(['audiences', 'from-events', ...argv], {
      env: {
        BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
        BREW_API_KEY: 'brew_abcdefghijklmnopqrstuvwxyz012345',
      },
      ...(stdin === undefined ? {} : { stdin }),
    })
  }

  it('leaves a send-only flag request window for the API to derive', async () => {
    const result = await cli([
      '--name',
      'Send openers',
      '--send-id',
      'snd_1',
      '--event-types',
      'opened',
    ])
    expect(result.code).toBe(0)
    expect(bodies).toEqual([
      {
        name: 'Send openers',
        cohort: { eventTypes: ['opened'], sendId: 'snd_1' },
      },
    ])
  })

  it.each(['inline', 'stdin'])(
    'preserves a send-only %s JSON request, including complement controls',
    async (source) => {
      const input = {
        name: 'Unsent members',
        cohort: {
          eventTypes: ['sent'],
          sendId: 'snd_1',
          exclude: {},
          recipient: ['@example.com'],
        },
      }
      const json = JSON.stringify(input)
      const result = await cli(
        ['--input', source === 'stdin' ? '-' : json],
        source === 'stdin' ? json : undefined
      )
      expect(result.code).toBe(0)
      expect(bodies).toEqual([input])
    }
  )

  it('uses the merged send ID and preserves an explicit end', async () => {
    const result = await cli([
      '--input',
      JSON.stringify({ cohort: { eventTypes: ['opened'], sendId: 'snd_old' } }),
      '--send-id',
      'snd_new',
      '--until',
      TO,
    ])
    expect(result.code).toBe(0)
    expect(bodies).toEqual([
      { cohort: { eventTypes: ['opened'], sendId: 'snd_new', to: TO } },
    ])
  })

  it('preserves an explicit window alongside a send ID', async () => {
    const result = await cli([
      '--event-types',
      'opened',
      '--send-id',
      'snd_1',
      '--since',
      FROM,
      '--until',
      TO,
    ])
    expect(result.code).toBe(0)
    expect(bodies).toEqual([
      {
        cohort: { eventTypes: ['opened'], sendId: 'snd_1', from: FROM, to: TO },
      },
    ])
  })

  it('continues to accept a window without a send ID', async () => {
    const result = await cli(['--event-types', 'opened', '--since', FROM])
    expect(result.code).toBe(0)
    expect(bodies).toEqual([{ cohort: { eventTypes: ['opened'], from: FROM } }])
  })

  it.each([
    { eventTypes: ['opened'] },
    { eventTypes: ['opened'], sendId: '' },
    { eventTypes: ['opened'], sendId: '   ' },
    { eventTypes: ['opened'], from: '' },
  ])('rejects a missing window and unusable send ID: %j', async (cohort) => {
    const result = await cli(['--input', JSON.stringify({ cohort })])
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('--since or --send-id')
    expect(bodies).toEqual([])
  })

  it('still requires event types when a send ID supplies the window', async () => {
    const result = await cli(['--send-id', 'snd_1'])
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('--event-types')
    expect(bodies).toEqual([])
  })
})
