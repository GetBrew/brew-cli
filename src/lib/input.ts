import { readFileSync } from 'node:fs'
import { CliUsageError } from './errors'
import { assertKnownInputKeys } from './input-keys'
import type { CliContext } from './types'

/**
 * The single deliberate boundary cast from user-supplied JSON to an SDK
 * input type. The public API strictly validates every request server-side
 * (the Zod contracts upstream of the OpenAPI spec); the CLI does not
 * duplicate those schemas.
 */
export function asSdkInput<T>(value: unknown): T {
  return value as T
}

/** Reads `--input <json|->`; `-` consumes stdin. */
export async function readJsonFlag(
  ctx: CliContext,
  value: unknown,
  flagName: string
): Promise<unknown> {
  if (typeof value !== 'string') {
    return
  }
  const raw = value === '-' ? await ctx.io.readStdin(ctx.signal) : value
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    throw new CliUsageError(
      `${flagName} must be valid JSON (or - to read stdin)`
    )
  }
  if (flagName === '--input') {
    assertKnownInputKeys(ctx.traits, parsed)
  }
  return parsed
}

/** Reads `--file <path|->`; `-` consumes stdin. */
export async function readTextFlag(
  ctx: CliContext,
  value: unknown,
  flagName: string
): Promise<string | undefined> {
  if (typeof value !== 'string') {
    return
  }
  if (value === '-') {
    return await ctx.io.readStdin(ctx.signal)
  }
  try {
    return readFileSync(value, 'utf8')
  } catch {
    throw new CliUsageError(`${flagName}: cannot read file "${value}"`)
  }
}

/** Parses repeatable `key=value` flag values into a record. */
export function parseKeyValues(
  value: unknown,
  flagName: string
): Record<string, string> | undefined {
  const items = toStringArray(value)
  if (items === undefined) {
    return
  }
  const record: Record<string, string> = {}
  for (const item of items) {
    const separator = item.indexOf('=')
    if (separator <= 0) {
      throw new CliUsageError(
        `${flagName}: expected key=value, received "${item}"`
      )
    }
    record[item.slice(0, separator)] = item.slice(separator + 1)
  }
  return record
}

/**
 * Parses repeatable `--filter field:operator[:value]` values into the
 * API's structured contact filter shape.
 */
export function parseFilterFlags(
  value: unknown
): ReadonlyArray<Record<string, string>> | undefined {
  const items = toStringArray(value)
  if (items === undefined) {
    return
  }
  return items.map((item) => {
    const [field, operator, ...rest] = item.split(':')
    if (!field || !operator) {
      throw new CliUsageError(
        `--filter: expected field:operator[:value], received "${item}"`
      )
    }
    return {
      field,
      operator,
      ...(rest.length === 0 ? {} : { value: rest.join(':') }),
    }
  })
}

/** Merges ergonomic flag overrides over a `--input` JSON body. */
export function mergeInput(
  base: unknown,
  overrides: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  if (base !== undefined && (base === null || typeof base !== 'object')) {
    throw new CliUsageError('--input must be a JSON object')
  }
  const merged: Record<string, unknown> = {
    ...((base as Record<string, unknown> | undefined) ?? {}),
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      merged[key] = value
    }
  }
  return merged
}

/** Preserve supplied strings, including empty values that clear API fields. */
export function flagString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/** Resource selectors must not turn an empty id into a collection read. */
export function flagNonEmptyString(
  value: unknown,
  flagName: string
): string | undefined {
  const parsed = flagString(value)
  if (parsed === '') {
    throw new CliUsageError(`${flagName} must not be empty.`)
  }
  return parsed
}

/** Exhaustive SDK request keys distinguish envelopes from shorthand data. */
export function isInputEnvelope<T extends object>(
  input: Readonly<Record<string, unknown>>,
  requiredKey: keyof T & string,
  allowedKeys: Readonly<Record<keyof T, true>>
): boolean {
  return (
    Object.hasOwn(input, requiredKey) &&
    Object.keys(input).every((key) => Object.hasOwn(allowedKeys, key))
  )
}

export function flagInt(value: unknown, flagName: string): number | undefined {
  if (value === undefined) {
    return
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliUsageError(`${flagName} must be a positive integer`)
  }
  return parsed
}

export function toStringArray(value: unknown): readonly string[] | undefined {
  if (Array.isArray(value)) {
    const items = value.filter(
      (item): item is string => typeof item === 'string'
    )
    return items.length > 0 ? items : undefined
  }
  return typeof value === 'string' ? [value] : undefined
}

/** Per-request SDK options derived from shared mutation flags. */
export function requestOptions(
  flags: Readonly<Record<string, unknown>>
): { idempotencyKey: string } | undefined {
  if (flags.idempotencyKey === undefined) return undefined
  const raw = flagString(flags.idempotencyKey)
  let key: string | undefined
  try {
    key =
      raw === undefined
        ? undefined
        : new Headers({ 'Idempotency-Key': raw }).get('Idempotency-Key')?.trim()
  } catch {
    throw new CliUsageError(
      '--idempotency-key must be a valid HTTP header value.'
    )
  }
  if (!key || key.length > 100) {
    throw new CliUsageError(
      '--idempotency-key must contain 1–100 characters after trimming.'
    )
  }
  return { idempotencyKey: key }
}

export const IDEMPOTENCY_FLAG = {
  flag: '--idempotency-key <key>',
  summary: 'Idempotency-Key for safe retries (auto-generated otherwise)',
} as const

/**
 * `--idempotency-key` on a route that never replays a request
 * (`x-brew-idempotency: disabled`). Flags are additive-only after release, so
 * the flag stays and is still sent, but its help must not promise a safe
 * retry.
 */
export const NON_REPLAYING_IDEMPOTENCY_FLAG = {
  flag: '--idempotency-key <key>',
  summary:
    'Accepted for compatibility only: this route never replays, so a retry runs again',
} as const

export const INPUT_FLAG = {
  flag: '--input <json>',
  summary: 'Full JSON request body, or - to read stdin (flags override it)',
} as const
