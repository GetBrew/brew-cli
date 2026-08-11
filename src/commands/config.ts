import { maskApiKey } from '../lib/client'
import {
  configPath,
  isConfigKey,
  readConfig,
  updateConfig,
} from '../lib/config-store'
import { defineCommand } from '../lib/define-command'
import { CliUsageError } from '../lib/errors'
import type { CliContext } from '../lib/types'

const SETTABLE_KEYS = ['brandId', 'apiUrl'] as const

export const configListCommand = defineCommand({
  path: ['config', 'list'],
  summary: 'Show the stored configuration (API key masked)',
  sdkMethod: null,
  commandClass: 'read',
  examples: ['brew-cli config list'],
  run: async ({ ctx }) => ({ data: maskedConfig(ctx) }),
})

export const configGetCommand = defineCommand({
  path: ['config', 'get'],
  summary: 'Read one stored configuration value',
  sdkMethod: null,
  commandClass: 'read',
  args: [
    { name: 'key', summary: 'brandId | apiUrl | apiKey', isRequired: true },
  ],
  examples: ['brew-cli config get brandId'],
  run: async ({ ctx, args }) => {
    const key = requireKnownKey(args.key)
    const value = maskedConfig(ctx)[key] ?? null
    return { data: { [key]: value } }
  },
})

export const configSetCommand = defineCommand({
  path: ['config', 'set'],
  summary: 'Store a configuration value (brandId or apiUrl)',
  sdkMethod: null,
  commandClass: 'write',
  args: [
    { name: 'key', summary: 'brandId | apiUrl', isRequired: true },
    { name: 'value', summary: 'The value to store', isRequired: true },
  ],
  examples: ['brew-cli config set brandId bd_123'],
  run: async ({ ctx, args }) => {
    const key = requireSettableKey(args.key)
    const value = args.value ?? ''
    if (value === '') {
      throw new CliUsageError('A non-empty value is required.')
    }
    const path = updateConfig(ctx.io.env, { [key]: value })
    return { data: { [key]: value, configPath: path } }
  },
})

export const configUnsetCommand = defineCommand({
  path: ['config', 'unset'],
  summary: 'Remove a stored configuration value (brandId or apiUrl)',
  sdkMethod: null,
  commandClass: 'write',
  args: [{ name: 'key', summary: 'brandId | apiUrl', isRequired: true }],
  examples: ['brew-cli config unset brandId'],
  run: async ({ ctx, args }) => {
    const key = requireSettableKey(args.key)
    const path = updateConfig(ctx.io.env, { [key]: undefined })
    return { data: { [key]: null, configPath: path } }
  },
})

function maskedConfig(ctx: CliContext): Record<string, string | undefined> {
  const stored = readConfig(ctx.io.env)
  return {
    ...stored,
    ...(stored.apiKey === undefined
      ? {}
      : { apiKey: maskApiKey(stored.apiKey) }),
    configPath: configPath(ctx.io.env),
  }
}

function requireKnownKey(
  value: string | undefined
): 'apiKey' | 'apiUrl' | 'brandId' {
  if (value !== undefined && isConfigKey(value)) {
    return value
  }
  throw new CliUsageError('Unknown key. Expected brandId, apiUrl, or apiKey.')
}

function requireSettableKey(value: string | undefined): 'apiUrl' | 'brandId' {
  if (value === 'apiKey') {
    throw new CliUsageError(
      'The API key is managed by `brew-cli login` / `brew-cli logout`.'
    )
  }
  const key = requireKnownKey(value)
  if ((SETTABLE_KEYS as readonly string[]).includes(key)) {
    return key as 'apiUrl' | 'brandId'
  }
  throw new CliUsageError('Unknown key. Expected brandId or apiUrl.')
}
