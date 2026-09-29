import type { BrewClient, SdkTransport } from './client'
import { buildSdkClient, resolveAuth } from './client'
import { CliTimeoutError } from './errors'
import { resolveOutputMode } from './output'
import {
  anySignal,
  createTransportState,
  parseMaxRetriesFlag,
  parseTimeoutFlag,
  recordingFetch,
  resolveBudget,
} from './transport'
import type {
  CliContext,
  ClientOptions,
  CliIo,
  CommandTraits,
  GlobalFlags,
} from './types'

export function makeContext(input: {
  readonly io: CliIo
  readonly flags: Readonly<Record<string, unknown>>
  readonly rawArgv: readonly string[]
  readonly traits?: CommandTraits
}): CliContext {
  const globals = readGlobalFlags(input.flags)
  const mode = resolveOutputMode({
    isJsonFlag: globals.json,
    isTtyOut: input.io.isTtyOut,
  })
  const budget = resolveBudget({
    timeoutMs: globals.timeoutMs,
    defaultTimeoutMs: input.traits?.defaultTimeoutMs,
  })
  const deadline = new AbortController()
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined
  const { signal } = anySignal([input.io.signal, deadline.signal])
  const transport = createTransportState()
  const cache = new Map<string, BrewClient>()
  const ctx: CliContext = {
    io: input.io,
    mode,
    globals,
    rawArgv: input.rawArgv,
    signal,
    budget,
    transport,
    traits: input.traits,
    startDeadline: () => {
      const ms = budget.deadlineMs
      if (ms === undefined || deadlineTimer !== undefined) {
        return
      }
      deadlineTimer = setTimeout(() => {
        deadline.abort(new CliTimeoutError(ms))
      }, ms)
    },
    stopDeadline: () => {
      if (deadlineTimer !== undefined) {
        clearTimeout(deadlineTimer)
      }
    },
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
      const client = buildSdkClient(auth, sdkTransportFor(ctx))
      cache.set(key, client)
      return client
    },
  }
  return ctx
}

/**
 * The transport every SDK client of this command shares: the command's
 * signal (interrupt + deadline), the request recorder, and the per-attempt
 * `--timeout` / `--max-retries` when given.
 */
export function sdkTransportFor(ctx: CliContext): SdkTransport {
  return {
    signal: ctx.signal,
    fetch: recordingFetch(ctx.transport),
    timeoutMs: ctx.budget.attemptMs,
    maxRetries: ctx.globals.maxRetries,
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
    timeoutMs: parseTimeoutFlag(flags.timeout),
    maxRetries: parseMaxRetriesFlag(flags.maxRetries),
  }
}

function readStringFlag(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}
