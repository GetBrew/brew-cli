import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { ALL_COMMANDS } from '../src/registry'
import { SPEC_SKIP_LIST } from '../src/skip-list'

/**
 * Spec operations whose commands are still being built, phase by phase.
 * This list must ONLY shrink; it must be empty before 0.1.0 ships.
 */
const PENDING_BUILD_ROUTES: readonly string[] = []

/**
 * Commands built AHEAD of the platform: the payload-contract wave-2 API
 * routes are not in the live published spec yet (the platform PRs are
 * still open), so the vendored spec cannot list them. Keep this fact in
 * the parity test, not in production command metadata. Every entry
 * becomes stale — and the guard below fails — the moment the refreshed
 * spec publishes the route; delete it then.
 */
const PENDING_SPEC_ROUTES: readonly string[] = [
  'GET /v1/automations/triggers/{triggerEventId}/contract',
  'PUT /v1/automations/triggers/{triggerEventId}/contract',
  'POST /v1/automations/triggers/{triggerEventId}/contract/validate',
  'POST /v1/payload-contracts/infer',
]

function specOperations(): readonly string[] {
  const raw = readFileSync(
    join(import.meta.dirname, '../openapi/public-api-v1.yaml'),
    'utf8'
  )
  const doc = parse(raw) as {
    paths?: Record<string, Record<string, unknown>>
  }
  const ops: string[] = []
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const method of ['get', 'post', 'patch', 'delete', 'put']) {
      if (method in item) {
        ops.push(`${method.toUpperCase()} ${path}`)
      }
    }
  }
  return ops.sort()
}

describe('parity: vendored OpenAPI spec ↔ CLI commands', () => {
  const ops = specOperations()
  const commandRoutes = new Set(
    ALL_COMMANDS.flatMap((spec) =>
      spec.route === undefined
        ? []
        : [`${spec.route.method} ${spec.route.path}`]
    )
  )
  const skipped = new Set(
    SPEC_SKIP_LIST.map((entry) => `${entry.method} ${entry.path}`)
  )

  it('accounts for every spec operation (command, skip, or pending build)', () => {
    const uncovered = ops.filter(
      (op) =>
        !commandRoutes.has(op) &&
        !skipped.has(op) &&
        !PENDING_BUILD_ROUTES.includes(op)
    )
    expect(uncovered).toEqual([])
  })

  it('declares only real spec operations on commands', () => {
    const opSet = new Set(ops)
    const phantom = [...commandRoutes].filter(
      (route) => !(opSet.has(route) || PENDING_SPEC_ROUTES.includes(route))
    )
    expect(phantom).toEqual([])
  })

  it('keeps pending-spec routes only while the spec lacks them', () => {
    const opSet = new Set(ops)
    const stale = PENDING_SPEC_ROUTES.filter((route) => opSet.has(route))
    expect(stale).toEqual([])
    // Each entry must back a real registered command, or it is dead weight.
    const unbacked = PENDING_SPEC_ROUTES.filter(
      (route) => !commandRoutes.has(route)
    )
    expect(unbacked).toEqual([])
  })

  it('has no stale spec skip-list entries', () => {
    const opSet = new Set(ops)
    const stale = [...skipped].filter((op) => !opSet.has(op))
    expect(stale).toEqual([])
    const shadowed = [...skipped].filter((op) => commandRoutes.has(op))
    expect(shadowed).toEqual([])
  })

  it('has no stale pending-build routes', () => {
    const opSet = new Set(ops)
    const stale = PENDING_BUILD_ROUTES.filter((op) => !opSet.has(op))
    expect(stale).toEqual([])
    const alreadyBuilt = PENDING_BUILD_ROUTES.filter((op) =>
      commandRoutes.has(op)
    )
    expect(alreadyBuilt).toEqual([])
  })
})
