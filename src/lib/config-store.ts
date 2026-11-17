import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

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
  const path = configPath(env)
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (error) {
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      try {
        if (lstatSync(path, { throwIfNoEntry: false }) === undefined) {
          return {}
        }
      } catch {
        // A failed path check is not evidence that configuration is absent.
      }
    }
    throw new Error(
      `Cannot read CLI configuration at "${path}". Check the file and its permissions.`
    )
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Parser errors may quote the stored API key; report only the path.
    throw invalidConfig(path)
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw invalidConfig(path)
  }
  const record = parsed as Record<string, unknown>
  const config: Record<string, string> = {}
  for (const key of CONFIG_KEYS) {
    const value = record[key]
    if (value === undefined) {
      continue
    }
    if (typeof value !== 'string') {
      throw invalidConfig(path)
    }
    if (value !== '') {
      config[key] = value
    }
  }
  return config
}

function invalidConfig(path: string): Error {
  return new Error(
    `Invalid CLI configuration at "${path}". Expected a JSON object with string values for apiKey, brandId and apiUrl. Fix the file or move it aside before retrying.`
  )
}

/** Atomically replaces the config, with owner-only file and staging permissions. */
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
  // Preserve an existing user-managed symlink; replace its resolved file atomically.
  const target = lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()
    ? realpathSync(path)
    : path
  const stagingDir = mkdtempSync(join(dirname(target), '.config-'))
  try {
    const stagingPath = join(stagingDir, 'config.json')
    writeFileSync(stagingPath, `${JSON.stringify(compact, null, 2)}\n`, {
      mode: 0o600,
    })
    chmodSync(stagingPath, 0o600)
    renameSync(stagingPath, target)
  } finally {
    rmSync(stagingDir, { recursive: true, force: true })
  }
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
