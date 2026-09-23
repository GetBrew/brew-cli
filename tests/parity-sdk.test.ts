import { createBrewClient } from '@brew.new/sdk'
import { describe, expect, it } from 'vitest'
import { ALL_COMMANDS } from '../src/registry'
import { SDK_SKIP_LIST } from '../src/skip-list'

/**
 * SDK methods that exist but whose commands are still being built, phase by
 * phase. This list must ONLY shrink; it must be empty before 0.1.0 ships.
 */
const PENDING_BUILD: readonly string[] = []

/**
 * SDK methods the CLI removed AHEAD of the SDK release that deletes them.
 * The list exists for the window between the API dropping a route and the
 * SDK publishing without the method, so a retargeted command does not have
 * to wait on the SDK.
 *
 * Empty since 10.0.0: that window has closed. SDK 10 removed
 * `analytics.campaigns`, `analytics.sends.*`, `analytics.triggerInstances.*`,
 * `automations.triggers.ready` and `automations.audienceRuns.control`, the
 * staleness test below fired on every sentinel, and each was retired — the
 * ratchet working exactly as designed.
 */
const REMOVED_SDK_LEAVES: readonly string[] = []

function walkSdkLeaves(): readonly string[] {
  const client = createBrewClient({ apiKey: 'brew_parity_walk' })
  const leaves: string[] = []
  const walk = (node: object, prefix: string): void => {
    for (const key of Object.keys(node)) {
      const value = (node as Record<string, unknown>)[key]
      const path = prefix === '' ? key : `${prefix}.${key}`
      if (typeof value === 'function') {
        leaves.push(path)
      } else if (value !== null && typeof value === 'object') {
        walk(value, path)
      }
    }
  }
  walk(client, '')
  return leaves.sort()
}

describe('parity: SDK surface ↔ CLI commands', () => {
  const leaves = walkSdkLeaves()
  const bound = ALL_COMMANDS.flatMap((spec) =>
    spec.sdkMethod === null ? [] : [spec.sdkMethod]
  )
  const derived = ALL_COMMANDS.flatMap((spec) => {
    if (spec.derivedFrom === undefined) {
      return []
    }
    return typeof spec.derivedFrom === 'string'
      ? [spec.derivedFrom]
      : [...spec.derivedFrom]
  })
  const skipped = SDK_SKIP_LIST.map((entry) => entry.sdkPath)
  const covered = new Set([
    ...bound,
    ...skipped,
    ...PENDING_BUILD,
    ...REMOVED_SDK_LEAVES,
  ])

  it('covers every installed SDK method with an explicit disposition', () => {
    const uncovered = leaves.filter((leaf) => !covered.has(leaf))
    expect(uncovered).toEqual([])
  })

  it('binds each SDK method to at most one command', () => {
    const seen = new Set<string>()
    const duplicates = bound.filter((method) => {
      if (seen.has(method)) {
        return true
      }
      seen.add(method)
      return false
    })
    expect(duplicates).toEqual([])
  })

  it('has no stale skip-list entries', () => {
    const leafSet = new Set(leaves)
    const stale = SDK_SKIP_LIST.filter(
      (entry) => !leafSet.has(entry.sdkPath)
    ).map((entry) => entry.sdkPath)
    expect(stale).toEqual([])
    const shadowed = SDK_SKIP_LIST.filter((entry) =>
      bound.includes(entry.sdkPath)
    ).map((entry) => entry.sdkPath)
    expect(shadowed).toEqual([])
  })

  it('has no stale pending-build entries', () => {
    const leafSet = new Set(leaves)
    const stale = PENDING_BUILD.filter((method) => !leafSet.has(method))
    expect(stale).toEqual([])
    const alreadyBuilt = PENDING_BUILD.filter((method) =>
      bound.includes(method)
    )
    expect(alreadyBuilt).toEqual([])
  })

  it('keeps removal sentinels only while the installed SDK needs them', () => {
    const leafSet = new Set(leaves)
    const stale = REMOVED_SDK_LEAVES.filter((method) => !leafSet.has(method))
    expect(stale).toEqual([])
  })

  it('resolves every declared sdkMethod and derivedFrom against the SDK', () => {
    const leafSet = new Set(leaves)
    const phantoms = [...bound, ...derived].filter(
      (method) => !leafSet.has(method)
    )
    expect(phantoms).toEqual([])
  })
})
