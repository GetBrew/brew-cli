import { describe, expect, it } from 'vitest'
import {
  EnvSecretExposureError,
  ensureEnvVars,
  ensureVar,
  formatEnvAssignment,
  getEnvValue,
  isClientExposedName,
  parseEnv,
  serializeEnv,
} from '../../../src/lib/project/env-file'

const SECRET = 'brew_live_secret_value_0123456789'

const SAMPLE = [
  '# Database',
  'DATABASE_URL="postgres://u:p@localhost/db"',
  '',
  'export NODE_ENV=development # inline comment',
  "SINGLE='literal $HOME'",
  'MULTI="line one',
  'line two"',
  'EMPTY=',
  'BROKEN LINE',
].join('\n')

describe('parseEnv / serializeEnv', () => {
  it('round-trips byte for byte: comments, order, quoting, export', () => {
    expect(serializeEnv(parseEnv(`${SAMPLE}\n`))).toBe(`${SAMPLE}\n`)
    expect(serializeEnv(parseEnv(SAMPLE))).toBe(SAMPLE)
    const crlf = `${SAMPLE.replaceAll('\n', '\r\n')}\r\n`
    expect(serializeEnv(parseEnv(crlf))).toBe(crlf)
  })

  it('reads values the way dotenv does', () => {
    const file = parseEnv(SAMPLE)
    expect(getEnvValue(file, 'DATABASE_URL')).toBe(
      'postgres://u:p@localhost/db'
    )
    expect(getEnvValue(file, 'NODE_ENV')).toBe('development')
    expect(getEnvValue(file, 'SINGLE')).toBe('literal $HOME')
    expect(getEnvValue(file, 'MULTI')).toBe('line one\nline two')
    expect(getEnvValue(file, 'EMPTY')).toBe('')
    expect(getEnvValue(file, 'MISSING')).toBeUndefined()
    expect(getEnvValue(parseEnv('A=1\nA=2\n'), 'A')).toBe('2')
    expect(getEnvValue(parseEnv('ESC="a\\nb"'), 'ESC')).toBe('a\nb')
  })
})

describe('ensureVar', () => {
  it('appends an absent variable and reports added (never the value)', () => {
    const { text, results } = ensureEnvVars(`${SAMPLE}\n`, [
      { name: 'BREW_API_KEY', value: SECRET },
    ])
    expect(text).toBe(`${SAMPLE}\nBREW_API_KEY=${SECRET}\n`)
    expect(results).toEqual([{ name: 'BREW_API_KEY', action: 'added' }])
    expect(JSON.stringify(results)).not.toContain(SECRET)
  })

  it('keeps an existing value untouched', () => {
    const before = 'BREW_API_KEY=brew_existing\n'
    const { text, results } = ensureEnvVars(before, [
      { name: 'BREW_API_KEY', value: SECRET },
    ])
    expect(text).toBe(before)
    expect(results).toEqual([{ name: 'BREW_API_KEY', action: 'kept-existing' }])
  })

  it('fills a present-but-empty variable in place', () => {
    const { text, results } = ensureEnvVars(
      '# keys\nexport BREW_API_KEY=\nOTHER=1\n',
      [{ name: 'BREW_API_KEY', value: SECRET }]
    )
    expect(text).toBe(`# keys\nexport BREW_API_KEY=${SECRET}\nOTHER=1\n`)
    expect(results[0]?.action).toBe('filled')
  })

  it('fills a key whose only content is a comment', () => {
    const file = parseEnv('BREW_API_KEY= # TODO\nB=x #note\nC=a#b\n')
    expect(getEnvValue(file, 'BREW_API_KEY')).toBe('')
    expect(getEnvValue(file, 'B')).toBe('x')
    expect(getEnvValue(file, 'C')).toBe('a#b')
    const { results } = ensureEnvVars('BREW_API_KEY= # TODO\n', [
      { name: 'BREW_API_KEY', value: SECRET },
    ])
    expect(results[0]?.action).toBe('filled')
  })

  it('round-trips mixed line endings untouched, and matches them when adding', () => {
    const mixed = 'A=1\r\nB=2\nC=3\r\n'
    expect(serializeEnv(parseEnv(mixed))).toBe(mixed)
    expect(ensureEnvVars(mixed, [{ name: 'B', value: 'x' }]).text).toBe(mixed)
    expect(ensureEnvVars(mixed, [{ name: 'D', value: '4' }]).text).toBe(
      `${mixed}D=4\r\n`
    )
    expect(
      ensureEnvVars('A=\r\nB=2\r\n', [{ name: 'A', value: '1' }]).text
    ).toBe('A=1\r\nB=2\r\n')
    expect(ensureEnvVars('X=1\r\nY=2', [{ name: 'A', value: '1' }]).text).toBe(
      'X=1\r\nY=2\r\nA=1\r\n'
    )
  })

  it('creates a file from nothing, and adds a final newline when missing', () => {
    expect(ensureEnvVars(null, [{ name: 'A', value: '1' }]).text).toBe('A=1\n')
    expect(ensureEnvVars('X=1', [{ name: 'A', value: '1' }]).text).toBe(
      'X=1\nA=1\n'
    )
    expect(ensureEnvVars('X=1\r\n', [{ name: 'A', value: '1' }]).text).toBe(
      'X=1\r\nA=1\r\n'
    )
  })

  it('refuses secrets under browser-exposed names', () => {
    for (const name of [
      'NEXT_PUBLIC_BREW_API_KEY',
      'VITE_BREW_API_KEY',
      'PUBLIC_BREW_API_KEY',
      'EXPO_PUBLIC_BREW_API_KEY',
    ]) {
      expect(isClientExposedName(name)).toBe(true)
      expect(() => ensureVar(parseEnv(''), name, SECRET)).toThrow(
        EnvSecretExposureError
      )
    }
    expect(() =>
      ensureVar(parseEnv(''), 'NEXT_PUBLIC_APP_URL', 'https://x.dev', {
        secret: false,
      })
    ).not.toThrow()
  })

  it('never puts the secret in the refusal message', () => {
    try {
      ensureVar(parseEnv(''), 'VITE_KEY', SECRET)
    } catch (error) {
      expect(String(error)).not.toContain(SECRET)
    }
  })

  it('quotes only when a value needs it', () => {
    expect(formatEnvAssignment('A', 'plain-value_1.2/3:4@5')).toBe(
      'A=plain-value_1.2/3:4@5'
    )
    expect(formatEnvAssignment('A', 'has space $x')).toBe("A='has space $x'")
    expect(formatEnvAssignment('A', "it's\nmulti")).toBe('A="it\'s\\nmulti"')
    expect(
      getEnvValue(parseEnv(formatEnvAssignment('A', "it's\nmulti")), 'A')
    ).toBe("it's\nmulti")
  })
})
