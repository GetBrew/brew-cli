import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import {
  IDEMPOTENCY_FLAG,
  NON_REPLAYING_IDEMPOTENCY_FLAG,
} from '../src/lib/input'
import { ALL_COMMANDS } from '../src/registry'

/**
 * The shared `--idempotency-key` help promises a safe retry, so a command
 * carries it only when its route replays a keyed request
 * (`x-brew-idempotency`: `replay`, or `fail_closed`, which also refuses while
 * the key store is down). A route that never replays (`none`, `disabled`:
 * `createApiKey` would disclose the one-time plaintext key again) runs a
 * retry twice; flags are additive-only, so such a command keeps the flag
 * with the help that says so (`NON_REPLAYING_IDEMPOTENCY_FLAG`).
 */
function publishedIdempotency(): Map<string, string> {
  const doc = parse(
    readFileSync(
      join(import.meta.dirname, '../openapi/public-api-v1.yaml'),
      'utf8'
    )
  ) as {
    paths?: Record<string, Record<string, { 'x-brew-idempotency'?: string }>>
  }
  const byRoute = new Map<string, string>()
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const [method, operation] of Object.entries(item)) {
      const policy = operation['x-brew-idempotency']
      if (policy) {
        byRoute.set(`${method.toUpperCase()} ${path}`, policy)
      }
    }
  }
  return byRoute
}

const REPLAYING = new Set(['replay', 'fail_closed'])

/** `brew-cli api` sends a raw request: the caller picks the route. */
const RAW_REQUEST_COMMANDS = new Set(['api'])

type Command = (typeof ALL_COMMANDS)[number]

/**
 * The routes a command runs: its own, or, for a verb-flag form with no route
 * (`audience-runs control`), those of the commands it `derivedFrom`.
 */
function routesOf(command: Command): Array<string> {
  if (command.route) {
    return [`${command.route.method} ${command.route.path}`]
  }
  const derived = [command.derivedFrom ?? []].flat()
  return ALL_COMMANDS.flatMap((other) =>
    other.route &&
    typeof other.sdkMethod === 'string' &&
    derived.includes(other.sdkMethod)
      ? [`${other.route.method} ${other.route.path}`]
      : []
  )
}

describe('--idempotency-key flags', () => {
  it('promise a safe retry only on commands whose route replays a keyed request', () => {
    const policies = publishedIdempotency()
    const offered = ALL_COMMANDS.filter(
      (command) =>
        command.flags?.some((flag) => flag === IDEMPOTENCY_FLAG) &&
        !RAW_REQUEST_COMMANDS.has(command.path.join(' '))
    )
    expect(offered.length).toBeGreaterThan(10)
    const misleading = offered.flatMap((command) => {
      const routes = routesOf(command)
      const unsafe = routes.filter(
        (route) => !REPLAYING.has(policies.get(route) ?? 'unpublished')
      )
      return routes.length > 0 && unsafe.length === 0
        ? []
        : [
            `${command.path.join(' ')} (${
              unsafe
                .map((route) => `${route}: ${policies.get(route)}`)
                .join(', ') || 'no route'
            })`,
          ]
    })
    expect(misleading).toEqual([])
  })

  it('say a retry runs again on commands whose route never replays', () => {
    const policies = publishedIdempotency()
    const unsafe = ALL_COMMANDS.filter((command) => {
      const routes = routesOf(command)
      return (
        routes.length > 0 &&
        routes.some(
          (route) => !REPLAYING.has(policies.get(route) ?? 'unpublished')
        ) &&
        command.flags?.some((flag) =>
          flag.flag.startsWith('--idempotency-key ')
        )
      )
    })
    expect(unsafe.map((command) => command.path.join(' '))).toEqual([
      'api-keys create',
    ])
    for (const command of unsafe) {
      expect(command.flags).toContain(NON_REPLAYING_IDEMPOTENCY_FLAG)
    }
  })
})
