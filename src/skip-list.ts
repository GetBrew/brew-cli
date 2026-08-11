import type { HttpMethod } from './lib/define-command'

/**
 * The two parity sentinels read these lists. Every entry is a deliberate,
 * reviewed decision — parity tests fail on anything unaccounted for, and
 * on entries that go stale (e.g. after an SDK upgrade closes a gap).
 */

export type SdkSkip = {
  /** Dotted SDK client path, e.g. `contacts.searchAll`. */
  readonly sdkPath: string
  readonly reason: string
}

export type SpecSkip = {
  readonly method: HttpMethod
  readonly path: string
  readonly reason: string
}

/** SDK methods that intentionally have no dedicated CLI command. */
export const SDK_SKIP_LIST: readonly SdkSkip[] = [
  {
    sdkPath: 'contacts.searchAll',
    reason: 'auto-pager covered by `contacts search --all`',
  },
  {
    sdkPath: 'analytics.eventsAll',
    reason: 'auto-pager covered by `analytics events --all`',
  },
  {
    sdkPath: 'analytics.sends.listAll',
    reason: 'auto-pager covered by `analytics sends list --all`',
  },
  {
    sdkPath: 'analytics.triggerInstances.listAll',
    reason: 'auto-pager covered by `analytics trigger-instances list --all`',
  },
  {
    sdkPath: 'brand.update',
    reason: 'SDK alias of brand.patch, exposed as `brand update`',
  },
  {
    sdkPath: 'emails.auditAccessibility',
    reason:
      'SDK 8.0.0 issues GET for the POST-only operation (upstream bug); `emails audit-accessibility` binds via raw transport instead',
  },
]

/**
 * Spec operations with no CLI command yet. Kept exact: the parity test
 * fails if one of these gains SDK support without gaining a command.
 */
export const SPEC_SKIP_LIST: readonly SpecSkip[] = []
