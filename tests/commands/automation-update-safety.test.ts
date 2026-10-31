import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const env = { BREW_API_KEY: 'brew_abcdefghijklmnopqrstuvwxyz012345' }
let bodies: unknown[]
beforeEach(() => {
  bodies = []
  server.use(
    http.patch(
      'https://brew.new/api/v1/automations/am_1',
      async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ automationId: 'am_1' })
      }
    )
  )
})
describe('resolved automation update confirmation', () => {
  it.each([
    { published: false, stopInFlight: true },
    { published: true },
    { paused: false },
  ])('requires confirmation for %j, including stdin', async (input) => {
    for (const source of [JSON.stringify(input), '-']) {
      const result = await runCli(
        ['automations', 'update', 'am_1', '--input', source],
        {
          env,
          stdin: JSON.stringify(input),
        }
      )
      expect(result.code).toBe(4)
      expect(result.json).toMatchObject({ confirmationRequired: true })
      expect(bodies).toEqual([])
    }
  })
  it('words the stopInFlight prompt so it holds for a draft too', async () => {
    const result = await runCli(
      [
        'automations',
        'update',
        'am_1',
        '--input',
        JSON.stringify({ published: false, stopInFlight: true }),
      ],
      { env }
    )
    expect(result.code).toBe(4)
    expect(result.json).toMatchObject({
      summary:
        'Permanently stop every contact already mid-flow in automation am_1, and unpublish it if it is live?',
    })
    expect(bodies).toEqual([])
  })
  it('returns confirmation-required after consuming interactive stdin', async () => {
    const result = await runCli(
      ['automations', 'update', 'am_1', '--input', '-'],
      {
        env,
        stdin: JSON.stringify({ published: true }),
        ttyIn: true,
        ttyOut: true,
        promptAnswer: 'yes',
      }
    )
    expect(result.code).toBe(4)
    expect(result.json).toMatchObject({ confirmationRequired: true })
    expect(bodies).toEqual([])
  })
  it.each([['--input', '-'], ['--input=-']])(
    'preserves consumed input in confirmation reruns: %j',
    async (...inputFlag) => {
      const input = { published: true, name: 'Original' }
      const result = await runCli(
        ['automations', 'update', 'am_1', ...inputFlag, '--name', 'Resolved'],
        {
          env,
          stdin: JSON.stringify(input),
        }
      )
      expect(result.code).toBe(4)
      const command = (result.json as { confirmCommand: string }).confirmCommand
      expect(command).toContain(
        JSON.stringify({ published: true, name: 'Resolved' })
      )
      expect(command).not.toContain('--input -')
      expect(command).not.toContain('--input=-')
      expect(bodies).toEqual([])
    }
  )

  it('can confirm inline input interactively', async () => {
    const input = { published: true }
    const result = await runCli(
      ['automations', 'update', 'am_1', '--input', JSON.stringify(input)],
      { env, ttyIn: true, ttyOut: true, promptAnswer: 'yes' }
    )
    expect(result.code).toBe(0)
    expect(bodies).toEqual([input])
  })
  it('sends the exact resolved stdin payload after confirmation', async () => {
    const input = { published: false, stopInFlight: true }
    const result = await runCli(
      ['automations', 'update', 'am_1', '--input', '-', '--yes'],
      {
        env,
        stdin: JSON.stringify(input),
      }
    )
    expect(result.code).toBe(0)
    expect(bodies).toEqual([input])
  })
  it.each([
    { name: 'Welcome' },
    { published: false },
    { name: 'Dry run draft', dryRun: true },
  ])('does not gate safe updates or dry runs: %j', async (input) => {
    const result = await runCli(
      ['automations', 'update', 'am_1', '--input', JSON.stringify(input)],
      { env }
    )
    expect(result.code).toBe(0)
    expect(bodies).toEqual([input])
  })
})
