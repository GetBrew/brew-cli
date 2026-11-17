import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  configPath,
  readConfig,
  updateConfig,
  writeConfig,
} from '../../src/lib/config-store'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, renameSync: vi.fn(actual.renameSync) }
})

const temporaryDirectories: string[] = []

function tempEnv(): Record<string, string> {
  const dir = mkdtempSync(join(tmpdir(), 'brew-cli-test-'))
  temporaryDirectories.push(dir)
  return { BREW_CLI_CONFIG_DIR: dir }
}

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('config store', () => {
  it('round-trips config with owner-only permissions', () => {
    const env = tempEnv()
    const path = writeConfig(env, {
      apiKey: 'brew_abcdefghijklmnopqrstuvwxyz012345',
      brandId: 'bd_1',
    })
    expect(path).toBe(configPath(env))
    expect(readConfig(env)).toEqual({
      apiKey: 'brew_abcdefghijklmnopqrstuvwxyz012345',
      brandId: 'bd_1',
    })
    expect(statSync(path).mode & 0o777).toBe(0o600)
  })

  it('merges updates and removes keys set to undefined', () => {
    const env = tempEnv()
    writeConfig(env, { apiKey: 'brew_key', brandId: 'bd_1' })
    updateConfig(env, {
      apiKey: undefined,
      apiUrl: 'http://localhost:3000/api',
    })
    expect(readConfig(env)).toEqual({
      brandId: 'bd_1',
      apiUrl: 'http://localhost:3000/api',
    })
  })

  it('returns an empty config for a missing file', () => {
    const env = tempEnv()
    expect(readConfig(env)).toEqual({})
  })

  it.each(['not json', 'null', '[]', '42', '{"brandId":12}'])(
    'reports damaged configuration without overwriting it: %s',
    (raw) => {
      const env = tempEnv()
      const path = configPath(env)
      writeFileSync(path, raw)
      expect(() => readConfig(env)).toThrow(path)
      expect(() => updateConfig(env, { brandId: 'bd_new' })).toThrow(path)
      expect(readFileSync(path, 'utf8')).toBe(raw)
    }
  )

  it('does not include stored secrets in a parse error', () => {
    const env = tempEnv()
    writeFileSync(configPath(env), '{"apiKey":"brew_secret", broken}')
    expect(() => readConfig(env)).toThrow(/Fix the file or move it aside/)
    try {
      readConfig(env)
    } catch (error) {
      expect(String(error)).not.toContain('brew_secret')
    }
  })

  it('reports filesystem read errors instead of treating them as missing login', () => {
    const env = tempEnv()
    mkdirSync(configPath(env))
    expect(() => readConfig(env)).toThrow(/Cannot read CLI configuration/)
  })

  it('replaces an existing file with owner-only permissions', () => {
    const env = tempEnv()
    const path = configPath(env)
    writeFileSync(path, '{"brandId":"old"}', { mode: 0o644 })
    writeConfig(env, { brandId: 'new' })
    expect(readConfig(env)).toEqual({ brandId: 'new' })
    expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(readdirSync(env.BREW_CLI_CONFIG_DIR ?? '')).toEqual(['config.json'])
  })

  it('preserves the previous file and cleans up if committing the replacement fails', () => {
    const env = tempEnv()
    const path = writeConfig(env, { brandId: 'old' })
    const original = readFileSync(path, 'utf8')
    vi.mocked(renameSync).mockImplementationOnce(() => {
      throw new Error('simulated rename failure')
    })
    expect(() => writeConfig(env, { brandId: 'new' })).toThrow(
      'simulated rename failure'
    )
    expect(readFileSync(path, 'utf8')).toBe(original)
    expect(readdirSync(env.BREW_CLI_CONFIG_DIR ?? '')).toEqual(['config.json'])
  })
})
