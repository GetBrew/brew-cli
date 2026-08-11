import type { BrewClient } from './client'
import { buildSdkClient, resolveAuth } from './client'
import { resolveOutputMode } from './output'
import type { CliContext, ClientOptions, CliIo, GlobalFlags } from './types'

export function makeContext(input: {
  readonly io: CliIo
  readonly flags: Readonly<Record<string, unknown>>
  readonly rawArgv: readonly string[]
}): CliContext {
  const globals = readGlobalFlags(input.flags)
  const mode = resolveOutputMode({
    isJsonFlag: globals.json,
    isTtyOut: input.io.isTtyOut,
  })
  const cache = new Map<string, BrewClient>()
  return {
    io: input.io,
    mode,
    globals,
    rawArgv: input.rawArgv,
    client: (options?: ClientOptions) => {
      const key = options?.allowAnonymous === true ? 'anonymous' : 'authed'
      const existing = cache.get(key)
      if (existing) {
        return existing
      }
      const auth = resolveAuth({
        globals,
        env: input.io.env,
        allowAnonymous: options?.allowAnonymous === true,
      })
      const client = buildSdkClient(auth)
      cache.set(key, client)
      return client
    },
  }
}

/**
 * Fallback context for failures that happen before a command action runs
 * (usage errors, help). Only argv can tell us whether --json was intended.
 */
export function makeFallbackContext(
  io: CliIo,
  rawArgv: readonly string[]
): CliContext {
  const flags: Record<string, unknown> = {
    json: rawArgv.includes('--json'),
    quiet: rawArgv.includes('--quiet'),
  }
  return makeContext({ io, flags, rawArgv })
}

function readGlobalFlags(
  flags: Readonly<Record<string, unknown>>
): GlobalFlags {
  return {
    json: flags.json === true,
    quiet: flags.quiet === true,
    yes: flags.yes === true,
    apiKey: readStringFlag(flags.apiKey),
    brand: readStringFlag(flags.brand),
    apiUrl: readStringFlag(flags.apiUrl),
  }
}

function readStringFlag(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}
