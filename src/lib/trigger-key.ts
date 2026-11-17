import { CliUsageError } from './errors'

/**
 * The trigger key grammar (brew-v2 `lib/triggers/trigger-key.ts`): 1–64
 * characters of lowercase letters, digits, `.`, `_` and `-`, starting and
 * ending with a letter or digit. Checked locally so a typo exits 2 before
 * any request instead of an API 400 (exit 1).
 */
export const TRIGGER_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/

export function triggerKeyArg(value: unknown, label: string): string {
  const key = typeof value === 'string' ? value : ''
  if (!TRIGGER_KEY_PATTERN.test(key)) {
    throw new CliUsageError(
      `${label} must be a trigger key: 1-64 lowercase letters, digits, ".", "_" or "-", starting and ending with a letter or digit (e.g. order.paid). Got ${JSON.stringify(key)}.`
    )
  }
  return key
}
