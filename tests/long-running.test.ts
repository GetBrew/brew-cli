import { describe, expect, it } from 'vitest'
import {
  LONG_RUNNING_ROUTES,
  longRunningTimeoutMs,
  matchesTemplate,
} from '../src/lib/long-running'
import { ALL_COMMANDS } from '../src/registry'

/**
 * A command bound to a long-running route declares that route's SDK
 * default as its whole-command deadline, and no other command declares
 * one: the CLI and the SDK never disagree about how long a call may take,
 * and a new long-running command cannot ship on the 30 s default.
 */
describe('long-running command deadlines', () => {
  it('every command on a long-running route declares its SDK default', () => {
    const mismatches = ALL_COMMANDS.flatMap((spec) => {
      const expected =
        spec.route === undefined
          ? undefined
          : LONG_RUNNING_ROUTES.find(
              (route) =>
                route.method === spec.route?.method &&
                route.path === spec.route.path
            )?.timeoutMs
      return spec.defaultTimeoutMs === expected
        ? []
        : [
            `${spec.path.join(' ')}: declares ${String(spec.defaultTimeoutMs)}, route default ${String(expected)}`,
          ]
    })
    expect(mismatches).toEqual([])
  })

  it('every long-running route has a command', () => {
    const unbound = LONG_RUNNING_ROUTES.filter(
      (route) =>
        !ALL_COMMANDS.some(
          (spec) =>
            spec.route?.method === route.method &&
            spec.route.path === route.path
        )
    ).map((route) => `${route.method} ${route.path}`)
    expect(unbound).toEqual([])
  })

  it('looks a concrete path up by its route template', () => {
    expect(
      longRunningTimeoutMs({ method: 'PATCH', path: '/v1/emails/eml_1?x=1' })
    ).toBe(240_000)
    expect(
      longRunningTimeoutMs({ method: 'GET', path: '/v1/emails/eml_1' })
    ).toBeUndefined()
    expect(matchesTemplate('/v1/emails/{emailId}', '/v1/emails/')).toBe(false)
  })
})
