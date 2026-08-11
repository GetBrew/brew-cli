import { mkdtempSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  configPath,
  readConfig,
  updateConfig,
  writeConfig,
} from '../../src/lib/config-store'

function tempEnv(): Record<string, string> {
  return { BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')) }
}

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

  it('returns an empty config for missing or malformed files', () => {
    const env = tempEnv()
    expect(readConfig(env)).toEqual({})
    writeFileSync(configPath(env), 'not json')
    expect(readConfig(env)).toEqual({})
  })
})
