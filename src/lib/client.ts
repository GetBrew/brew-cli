import { createBrewClient } from '@brew.new/sdk'
import { CLI_NAME, CLI_VERSION } from '../version'
import { readConfig } from './config-store'
import { CliAuthError } from './errors'
import type { GlobalFlags } from './types'

export type BrewClient = ReturnType<typeof createBrewClient>

export const DEFAULT_API_URL = 'https://brew.new/api'

export const LOGIN_KEYS_URL = 'https://brew.new/settings/api'

/**
 * Placeholder key for the unauthenticated endpoints (health, help,
 * llms.txt). The SDK requires a non-empty key; the server ignores it.
 */
export const ANONYMOUS_API_KEY = 'brew_anonymous'

/**
 * Organization-level route prefixes. These ride the org transport and must
 * never receive an X-Brand-Id header (the server ignores it there, but the
 * SDK's own withBrand keeps the same discipline).
 */
const ORG_LEVEL_PATH_PREFIXES = [
  '/v1/brands',
  '/v1/usage',
  '/v1/templates',
  '/v1/health',
  '/v1/help',
  '/v1/llms.txt',
  '/v1/api-keys',
] as const

export type AuthSource = 'anonymous' | 'config' | 'env' | 'flag'

export type ResolvedAuth = {
  readonly apiKey: string
  readonly apiKeySource: AuthSource
  readonly brandId: string | undefined
  readonly apiUrl: string
}

export function resolveAuth(input: {
  readonly globals: GlobalFlags
  readonly env: Readonly<Record<string, string | undefined>>
  readonly allowAnonymous?: boolean
}): ResolvedAuth {
  const { globals, env } = input
  const stored = readConfig(env)
  const keyFromFlag = globals.apiKey
  const keyFromEnv = readEnvValue(env.BREW_API_KEY)
  const keyFromConfig = stored.apiKey
  const apiKey = keyFromFlag ?? keyFromEnv ?? keyFromConfig
  const apiUrl =
    globals.apiUrl ??
    readEnvValue(env.BREW_API_URL) ??
    stored.apiUrl ??
    DEFAULT_API_URL
  const brandId =
    globals.brand ?? readEnvValue(env.BREW_BRAND_ID) ?? stored.brandId
  if (!apiKey) {
    if (input.allowAnonymous === true) {
      return {
        apiKey: ANONYMOUS_API_KEY,
        apiKeySource: 'anonymous',
        brandId,
        apiUrl,
      }
    }
    throw new CliAuthError(
      'No API key found.',
      `Run \`brew-cli login\`, set BREW_API_KEY, or pass --api-key. Create keys at ${LOGIN_KEYS_URL}`
    )
  }
  const apiKeySource: AuthSource = keyFromFlag
    ? 'flag'
    : keyFromEnv
      ? 'env'
      : 'config'
  return { apiKey, apiKeySource, brandId, apiUrl }
}

export function buildSdkClient(auth: ResolvedAuth): BrewClient {
  return createBrewClient({
    apiKey: auth.apiKey,
    baseUrl: auth.apiUrl,
    userAgent: `${CLI_NAME}/${CLI_VERSION}`,
    ...(auth.brandId === undefined ? {} : { brandId: auth.brandId }),
  })
}

export function isOrgLevelPath(url: string): boolean {
  let pathname: string
  try {
    pathname = new URL(url).pathname
  } catch {
    pathname = url.split('?')[0] ?? url
  }
  const versionIndex = pathname.indexOf('/v1/')
  if (versionIndex === -1) {
    return false
  }
  const apiPath = pathname.slice(versionIndex)
  return ORG_LEVEL_PATH_PREFIXES.some(
    (prefix) => apiPath === prefix || apiPath.startsWith(`${prefix}/`)
  )
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 12) {
    return `${apiKey.slice(0, 3)}…`
  }
  return `${apiKey.slice(0, 8)}…${apiKey.slice(-3)}`
}

function readEnvValue(value: string | undefined): string | undefined {
  return value !== undefined && value !== '' ? value : undefined
}
