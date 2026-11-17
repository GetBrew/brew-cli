import { describe, expect, it } from 'vitest'
import { runCli } from '../helpers/run-cli'

describe('prepared command input budget', () => {
  it('times input preparation and refuses dispatch when it has expired', async () => {
    let dispatched = false
    const result = await runCli(['slow-input', '--timeout', '20ms'], {
      extraCommands: [
        {
          path: ['slow-input'],
          summary: 'Prepare input slowly',
          commandClass: 'read',
          sdkMethod: null,
          examples: ['brew-cli slow-input'],
          prepareInput: async () => {
            await new Promise((resolve) => setTimeout(resolve, 80))
            return { ready: true }
          },
          run: async () => {
            dispatched = true
            return { data: { done: true } }
          },
        },
      ],
    })
    expect(result.code).toBe(1)
    expect(result.stdout).toBe('')
    expect(JSON.parse(result.stderr)).toMatchObject({
      error: { code: 'CLI_TIMEOUT' },
    })
    expect(dispatched).toBe(false)
  })
})
