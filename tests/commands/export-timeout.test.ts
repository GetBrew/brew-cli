import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { expect, it, vi } from 'vitest'
import * as sdkClient from '../../src/lib/client'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

it.each([
  { label: 'default', flags: [], expectedMs: 800_000 },
  { label: 'shorter explicit', flags: ['--timeout', '2s'], expectedMs: 2000 },
  {
    label: 'longer explicit',
    flags: ['--timeout', '20m'],
    expectedMs: 1_200_000,
  },
])(
  'passes the $label export timeout to the SDK request',
  async ({ flags, expectedMs }) => {
    let requestTimeoutMs: number | undefined
    let requests = 0
    const buildClient = sdkClient.buildSdkClient
    vi.spyOn(sdkClient, 'buildSdkClient').mockImplementation((...args) => {
      const client = buildClient(...args)
      const exportEmail = client.emails.export.bind(client.emails)
      vi.spyOn(client.emails, 'export').mockImplementation((input, options) => {
        requestTimeoutMs = options?.timeoutMs
        return exportEmail(input, options)
      })
      return client
    })
    server.use(
      http.post('https://brew.new/api/v1/emails/eml_1/export', () => {
        requests += 1
        return HttpResponse.json({ provider: 'loops', dryRun: true })
      })
    )

    const result = await runCli(
      [
        'emails',
        'export',
        'eml_1',
        '--provider',
        'loops',
        '--dry-run',
        ...flags,
      ],
      {
        env: {
          BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
          BREW_API_KEY: 'brew_abcdefghijklmnopqrstuvwxyz012345',
        },
      }
    )

    expect(result.code).toBe(0)
    expect(requests).toBe(1)
    expect(requestTimeoutMs).toBe(expectedMs)
  }
)
