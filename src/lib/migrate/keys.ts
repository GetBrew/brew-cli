import type { AppEmailKitKey } from '@brew.new/sdk'
import { TRIGGER_KEY_PATTERN } from '../project/state'

/**
 * Trigger keys for migrated emails. A Resend template alias (or name) and a
 * React Email file name become a key in the shared grammar
 * (`^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$`, unique per brand), clear of
 * the reserved ones: `kit`, `by-key`, `brew.*`, and `auth.*` other than the
 * canonical kit keys.
 */

export const CANONICAL_KIT_KEYS = [
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
] as const satisfies readonly AppEmailKitKey[]

const CANONICAL = new Set<string>(CANONICAL_KIT_KEYS)
const MAX_KEY_LENGTH = 64
const PREFIX_PATTERN = /^[a-z0-9][a-z0-9._-]{0,31}$/

export function isCanonicalKitKey(key: string): boolean {
  return CANONICAL.has(key)
}

/** Why a `--key-prefix` cannot be used, or `undefined` when it can. */
export function keyPrefixProblem(prefix: string): string | undefined {
  if (!PREFIX_PATTERN.test(prefix)) {
    return 'it must start with a lowercase letter or digit and use only a-z, 0-9, ".", "_" and "-" (32 characters at most)'
  }
  if (prefix.startsWith('brew.') || prefix === 'brew') {
    return '`brew.` keys are reserved'
  }
  if (prefix.startsWith('auth.') || prefix === 'auth') {
    return '`auth.` keys are reserved for the starter kit'
  }
  return undefined
}

/** `Reset Password!` → `reset-password`; empty when nothing usable is left. */
export function slugifyKey(raw: string): string {
  const slug = raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\.{2,}/g, '.')
  return trimEnds(slug)
}

/** `OrderShipped` → `order-shipped`, for React Email file names. */
export function slugifyFileName(name: string): string {
  return slugifyKey(
    name
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
  )
}

function trimEnds(value: string): string {
  return value.replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]+$/, '')
}

function fitKey(value: string, room: number): string {
  return trimEnds(value.slice(0, Math.max(1, room)))
}

/** A key clear of the reserved names (the prefix is already checked). */
function clearOfReserved(key: string): string {
  if (isCanonicalKitKey(key)) {
    return key
  }
  if (key.startsWith('auth.')) {
    return `auth-${key.slice('auth.'.length)}`
  }
  if (key.startsWith('brew.')) {
    return `brew-${key.slice('brew.'.length)}`
  }
  if (key === 'kit' || key === 'by-key' || key === 'brew' || key === 'auth') {
    return `${key}-email`
  }
  return key
}

/**
 * The key for `base` (an alias, a name, a file name) under `prefix`,
 * unique against `taken` (which it joins). `fallback` names a source with
 * nothing usable in it (`template`, `email`).
 */
export function deriveKey(input: {
  readonly base: string
  readonly prefix: string
  readonly taken: Set<string>
  readonly fallback: string
}): string {
  const slug = slugifyKey(input.base) || input.fallback
  let key = clearOfReserved(
    fitKey(`${input.prefix}${slug}`, MAX_KEY_LENGTH) || input.fallback
  )
  if (!TRIGGER_KEY_PATTERN.test(key)) {
    key = input.fallback
  }
  let candidate = key
  for (let n = 2; input.taken.has(candidate); n += 1) {
    const suffix = `-${n}`
    // A suffixed kit key (`auth.password-reset-2`) is no kit key: Brew
    // refuses it as reserved, so it leaves auth.* as any other auth. key.
    candidate = clearOfReserved(
      `${fitKey(key, MAX_KEY_LENGTH - suffix.length)}${suffix}`
    )
  }
  input.taken.add(candidate)
  return candidate
}
