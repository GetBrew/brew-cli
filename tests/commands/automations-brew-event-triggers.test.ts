import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { automationsTriggersEnsureBrewEventCommand } from '../../src/commands/automations/triggers/ensure-brew-event'
import type { components } from '../../src/generated/openapi-types'
import { server } from '../helpers/msw-server'
import { type RunCliResult, runCli } from '../helpers/run-cli'

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const API = 'https://brew.new/api'
const ROUTE = `${API}/v1/automations/triggers/brew-events`

function cli(argv: readonly string[]): Promise<RunCliResult> {
  return runCli(['automations', 'triggers', 'ensure-brew-event', ...argv], {
    env: {
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
      BREW_API_KEY: KEY,
    },
    extraCommands: [automationsTriggersEnsureBrewEventCommand],
  })
}

const SAVED: components['schemas']['BrewEventTriggerSaved'] = {
  triggerEventId: 'trg_news',
  title: 'Unsubscribed from news.acme.com',
  provider: 'brew_event',
  providerEventKey: 'contact.unsubscribed',
  brewEvent: {
    event: 'contact.unsubscribed',
    scope: 'domain',
    domainHost: 'news.acme.com',
  },
  payloadSchema: {
    type: 'object',
    fields: [{ key: 'email', type: 'string', required: true }],
  },
  createdAt: '2026-10-13T12:00:00.000Z',
  updatedAt: '2026-10-13T12:00:00.000Z',
  created: true,
}

describe('automations triggers ensure-brew-event', () => {
  it('sends the domain scope with an idempotency key and prints the row', async () => {
    let body: unknown
    let key: string | null = null
    server.use(
      http.post(ROUTE, async ({ request }) => {
        body = await request.json()
        key = request.headers.get('idempotency-key')
        return HttpResponse.json(SAVED, { status: 201 })
      })
    )

    const result = await cli(['--scope', 'domain', '--domain-id', 'dom_news'])

    expect(result.code).toBe(0)
    expect(body).toEqual({
      event: 'contact.unsubscribed',
      scope: 'domain',
      domainId: 'dom_news',
    })
    expect(key).toEqual(expect.any(String))
    expect(JSON.parse(result.stdout)).toEqual(SAVED)
  })

  it('sends no domainId for every email the brand sends', async () => {
    let body: unknown
    server.use(
      http.post(ROUTE, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          {
            ...SAVED,
            brewEvent: { event: 'contact.unsubscribed', scope: 'all' },
            created: false,
          },
          { status: 200 }
        )
      })
    )

    const result = await cli(['--scope', 'all'])

    expect(result.code).toBe(0)
    expect(body).toEqual({ event: 'contact.unsubscribed', scope: 'all' })
  })

  it.each([
    [[], '--scope'],
    [['--scope', 'everything'], 'domain | all'],
    [['--scope', 'domain'], '--domain-id'],
    [['--scope', 'all', '--domain-id', 'dom_news'], '--domain-id'],
  ])('refuses %j as a usage error before any request', async (argv, hint) => {
    let isCalled = false
    server.use(
      http.post(ROUTE, () => {
        isCalled = true
        return HttpResponse.json(SAVED, { status: 201 })
      })
    )

    const result = await cli(argv)

    expect(result.code).toBe(2)
    expect(result.stderr).toContain(hint)
    expect(isCalled).toBe(false)
  })

  it('surfaces a transactional domain as the API error with exit 1', async () => {
    server.use(
      http.post(ROUTE, () =>
        HttpResponse.json(
          {
            error: {
              code: 'DOMAIN_PURPOSE_NOT_ALLOWED',
              type: 'invalid_request',
              message:
                'mail.acme.com is a transactional domain. Only marketing domains have an unsubscribe list.',
              param: 'domainId',
            },
          },
          { status: 422 }
        )
      )
    )

    const result = await cli(['--scope', 'domain', '--domain-id', 'dom_tx'])

    expect(result.code).toBe(1)
    const parsed = JSON.parse(result.stderr) as { error: { code: string } }
    expect(parsed.error.code).toBe('DOMAIN_PURPOSE_NOT_ALLOWED')
  })
})
