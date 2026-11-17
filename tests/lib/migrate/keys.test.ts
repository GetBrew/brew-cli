import { describe, expect, it } from 'vitest'
import {
  deriveKey,
  keyPrefixProblem,
  slugifyFileName,
} from '../../../src/lib/migrate/keys'
import { TRIGGER_KEY_PATTERN } from '../../../src/lib/project/state'

function key(base: string, prefix = '', taken = new Set<string>()): string {
  return deriveKey({ base, prefix, taken, fallback: 'template' })
}

describe('migration keys', () => {
  it.each([
    ['Reset Password!', 'reset-password'],
    ['reset-password', 'reset-password'],
    ['Ünïcödé Welcome', 'unicode-welcome'],
    ['auth.password-reset', 'auth.password-reset'],
    ['auth.reset', 'auth-reset'],
    ['brew.digest', 'brew-digest'],
    ['kit', 'kit-email'],
    ['by-key', 'by-key-email'],
    ['!!!', 'template'],
  ])('%s → %s', (base, expected) => {
    const derived = key(base)
    expect(derived).toBe(expected)
    expect(TRIGGER_KEY_PATTERN.test(derived)).toBe(true)
  })

  it('keeps keys unique within a run, and under 64 characters', () => {
    const taken = new Set<string>()
    expect(key('Welcome', '', taken)).toBe('welcome')
    expect(key('welcome', '', taken)).toBe('welcome-2')
    const long = key('x'.repeat(80), 'resend.', taken)
    expect(long.length).toBeLessThanOrEqual(64)
    expect(long.startsWith('resend.')).toBe(true)
  })

  it('a second item on a canonical kit key gets a key outside auth.*', () => {
    const taken = new Set<string>()
    expect(key('auth.password-reset', '', taken)).toBe('auth.password-reset')
    const second = key('auth.password-reset', '', taken)
    expect(second).toBe('auth-password-reset-2')
    expect(key('auth.password-reset', '', taken)).toBe('auth-password-reset-3')
    expect(second.startsWith('auth.')).toBe(false)
  })

  it('names React Email files in kebab case', () => {
    expect(slugifyFileName('OrderShipped')).toBe('order-shipped')
    expect(slugifyFileName('HTMLDigest')).toBe('html-digest')
  })

  it('refuses reserved or malformed prefixes', () => {
    expect(keyPrefixProblem('resend.')).toBeUndefined()
    expect(keyPrefixProblem('brew.')).toContain('reserved')
    expect(keyPrefixProblem('auth.')).toContain('reserved')
    expect(keyPrefixProblem('Resend')).toBeDefined()
  })
})
