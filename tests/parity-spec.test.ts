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
    const phantom = [...commandRoutes].filter((route) => !opSet.has(route))
    expect(phantom).toEqual([])
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
