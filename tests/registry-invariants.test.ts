import { describe, expect, it } from 'vitest'
import { GLOBAL_FLAGS } from '../src/lib/define-command'
import { ALL_COMMANDS } from '../src/registry'

describe('registry invariants', () => {
  it('gives every command a summary and at least one example', () => {
    for (const spec of ALL_COMMANDS) {
      expect(spec.summary.length, spec.path.join(' ')).toBeGreaterThan(0)
      expect(spec.examples.length, spec.path.join(' ')).toBeGreaterThan(0)
    }
  })

  it('pairs the destructive class with a confirmation summary, exactly', () => {
    for (const spec of ALL_COMMANDS) {
      const name = spec.path.join(' ')
      if (spec.commandClass === 'destructive') {
        expect(spec.confirmSummary, name).toBeDefined()
      } else {
        expect(spec.confirmSummary, name).toBeUndefined()
      }
    }
  })

  it('keeps command paths unique', () => {
    const seen = new Set<string>()
    for (const spec of ALL_COMMANDS) {
      const name = spec.path.join(' ')
      expect(seen.has(name), name).toBe(false)
      seen.add(name)
    }
  })

  it('marks derived commands correctly (null sdkMethod; one backing method declares its route, a fan-out declares none)', () => {
    for (const spec of ALL_COMMANDS) {
      if (spec.derivedFrom === undefined) {
        continue
      }
      const name = spec.path.join(' ')
      expect(spec.sdkMethod, name).toBeNull()
      if (typeof spec.derivedFrom === 'string') {
        expect(spec.route, name).toBeDefined()
      } else {
        // A verb-flag dispatcher spans several routes; declaring one would
        // misfile it in the spec parity, so it declares none.
        expect(spec.derivedFrom.length, name).toBeGreaterThan(1)
        expect(spec.route, name).toBeUndefined()
      }
    }
  })

  it('never shadows a global flag with a command flag', () => {
    const globalNames = new Set(
      GLOBAL_FLAGS.map((flag) => flag.flag.split(' ')[0])
    )
    for (const spec of ALL_COMMANDS) {
      for (const flag of spec.flags ?? []) {
        const name = flag.flag.split(' ')[0]
        expect(
          globalNames.has(name ?? ''),
          `${spec.path.join(' ')} ${name}`
        ).toBe(false)
      }
    }
  })
})
