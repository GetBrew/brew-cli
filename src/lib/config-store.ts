import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type StoredConfig = {
  readonly apiKey?: string
  readonly brandId?: string
  readonly apiUrl?: string
}

const CONFIG_KEYS = ['apiKey', 'brandId', 'apiUrl'] as const

export type ConfigKey = (typeof CONFIG_KEYS)[number]

export function isConfigKey(value: string): value is ConfigKey {
  return (CONFIG_KEYS as readonly string[]).includes(value)
}

export function configDir(
  env: Readonly<Record<string, string | undefined>>
): string {
  const override = env.BREW_CLI_CONFIG_DIR
  if (override !== undefined && override !== '') {
    return override
  }
  const xdg = env.XDG_CONFIG_HOME
  const base =
    xdg !== undefined && xdg !== '' ? xdg : join(homedir(), '.config')
  return join(base, 'brew-cli')
}

export function configPath(
  env: Readonly<Record<string, string | undefined>>
): string {
  return join(configDir(env), 'config.json')
}

export function readConfig(
  env: Readonly<Record<string, string | undefined>>
): StoredConfig {
  try {
    const raw = readFileSync(configPath(env), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') {
      return {}
    }
    const record = parsed as Record<string, unknown>
    const config: Record<string, string> = {}
    for (const key of CONFIG_KEYS) {
      const value = record[key]
      if (typeof value === 'string' && value !== '') {
        config[key] = value
      }
    }
    return config
  } catch {
    return {}
  }
}

/** Writes the config file with owner-only permissions (0600 / dir 0700). */
export function writeConfig(
  env: Readonly<Record<string, string | undefined>>,
  config: StoredConfig
): string {
  const dir = configDir(env)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const path = configPath(env)
  const compact: Record<string, string> = {}
  for (const key of CONFIG_KEYS) {
    const value = config[key]
    if (value !== undefined && value !== '') {
      compact[key] = value
    }
  }
  writeFileSync(path, `${JSON.stringify(compact, null, 2)}\n`, { mode: 0o600 })
  chmodSync(path, 0o600)
  return path
}

export function updateConfig(
  env: Readonly<Record<string, string | undefined>>,
  patch: Readonly<Partial<Record<ConfigKey, string | undefined>>>
): string {
  const current: Record<string, string | undefined> = { ...readConfig(env) }
  for (const key of CONFIG_KEYS) {
    if (key in patch) {
      current[key] = patch[key]
    }
  }
  return writeConfig(env, current)
}
