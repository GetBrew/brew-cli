import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const API = 'https://brew.new/api/v1'
const GOAL = {
  schemaVersion: 1,
  kind: 'event',
  event: { sourceId: 'source_project', providerEventKey: 'paid' },
  windowDays: 14,
  stopRemainingSends: true,
}
function cli(args: readonly string[]) {
  return runCli(args, {
    env: {
      BREW_API_KEY: 'brew_abcdefghijklmnopqrstuvwxyz012345',
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-lifecycle-')),
    },
  })
}

describe('additive lifecycle input contracts', () => {
  it('accepts goal JSON on creation and preserves an explicit null clear on update', async () => {
    const bodies: Array<unknown> = []
    server.use(
      http.post(`${API}/automations`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ automationId: 'auto_goal' }, { status: 201 })
      }),
      http.patch(`${API}/automations/auto_goal`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ automationId: 'auto_goal' })
      })
    )
    const input = {
      name: 'Activation',
      triggerEventId: 'trigger_signup',
      nodes: [],
      connections: [],
      goal: GOAL,
    }
    expect(
      (await cli(['automations', 'create', '--input', JSON.stringify(input)]))
        .code
    ).toBe(0)
    expect(
      (
        await cli([
          'automations',
          'update',
          'auto_goal',
          '--input',
          '{"goal":null}',
        ])
      ).code
    ).toBe(0)
    expect(bodies).toEqual([input, { goal: null }])
  })

  it('forwards outcome version and cursor from --input to the analytics query', async () => {
    let query: URLSearchParams | undefined
    server.use(
      http.get(`${API}/analytics/automations`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json({
          data: [],
          totals: {},
          range: {},
          truncated: false,
        })
      })
    )
    const input = {
      automationId: 'auto_goal',
      outcomesVersionId: 'version/one',
      outcomesCursor: 'cursor+/=opaque',
    }
    expect(
      (
        await cli([
          'analytics',
          'automations',
          '--input',
          JSON.stringify(input),
        ])
      ).code
    ).toBe(0)
    expect(Object.fromEntries(query ?? [])).toEqual(input)
  })

  it('passes the relative inactivity operator and numeric date operand unchanged', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/audiences`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ audienceId: 'aud_dormant' }, { status: 201 })
      })
    )
    const input = {
      name: 'Dormant',
      filters: {
        filters: [
          {
            field: 'posthog.last_used_at',
            operator: 'inactive_for_days',
            type: 'date',
            value: 30,
          },
        ],
        logicalOperator: 'and',
      },
    }
    expect(
      (await cli(['audiences', 'create', '--input', JSON.stringify(input)]))
        .code
    ).toBe(0)
    expect(body).toEqual(input)
  })
})
