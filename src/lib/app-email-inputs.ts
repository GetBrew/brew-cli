import { CliUsageError } from './errors'
import { flagString } from './input'

/**
 * The closed vocabularies of `/v1/app-emails` (brew-v2
 * `lib/app-emails/contracts.ts`), checked locally so a typo exits 2 before
 * any request. `tests/commands/app-emails.test.ts` pins them to the
 * vendored spec.
 */
export const APP_EMAIL_KIT_SETS = ['auth', 'lifecycle'] as const

export const APP_EMAIL_AUTH_STACKS = [
  'better-auth',
  'authjs',
  'supabase',
  'clerk',
  'firebase',
  'custom',
] as const

export const APP_EMAIL_KIT_KEYS = [
  'auth.verify-email',
  'auth.magic-link',
  'auth.otp',
  'auth.password-reset',
  'auth.invite',
  'auth.email-change',
  'auth.reauthentication',
  'auth.security-notice',
  'lifecycle.welcome',
  'lifecycle.trial-ending',
  'lifecycle.payment-failed',
  'lifecycle.win-back',
] as const

export const APP_EMAIL_SOURCE_FORMATS = ['html', 'mjml', 'jsx'] as const

/**
 * A comma-separated list flag. Omitted → undefined; given but empty (`""`,
 * `,`) is a usage error rather than "omitted", which would widen the call
 * to the whole kit.
 */
export function listFlag(
  value: unknown,
  flag: string,
  allowed: readonly string[]
): string[] | undefined {
  if (value === undefined) {
    return
  }
  const text = flagString(value) ?? ''
  const items = text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')
  if (items.length === 0) {
    throw new CliUsageError(
      `${flag} needs at least one value: ${allowed.join(', ')}.`
    )
  }
  const unknown = items.filter((item) => !allowed.includes(item))
  if (unknown.length > 0) {
    throw new CliUsageError(
      `${flag}: unknown ${unknown.map((item) => JSON.stringify(item)).join(', ')}. Use: ${allowed.join(', ')}.`
    )
  }
  return [...new Set(items)]
}

export function oneOfFlag(
  value: unknown,
  flag: string,
  allowed: readonly string[]
): string | undefined {
  const text = flagString(value)
  if (text === undefined) {
    return
  }
  if (!allowed.includes(text)) {
    throw new CliUsageError(
      `${flag}: unknown ${JSON.stringify(text)}. Use: ${allowed.join(', ')}.`
    )
  }
  return text
}

/**
 * `--input`'s `source` object, so `--source-file` can fill `format` and
 * `content` and keep the rest: the import modes `props`, `placeholders`
 * and `variables` (brew-v2#2169).
 */
export function inputSource(
  base: unknown
): Readonly<Record<string, unknown>> | undefined {
  if (base === null || typeof base !== 'object') {
    return
  }
  const source = (base as Record<string, unknown>).source
  return source !== null && typeof source === 'object' && !Array.isArray(source)
    ? (source as Record<string, unknown>)
    : undefined
}

/** `--input` given inline (not stdin), for confirmation summaries only. */
export function inlineInput(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string' || value === '-') {
    return {}
  }
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed !== null && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}
