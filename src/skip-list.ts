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
    sdkPath: 'sends.listAll',
    reason: 'auto-pager covered by `sends list --all`',
  },
  {
    sdkPath: 'automations.triggerInstances.listAll',
    reason: 'auto-pager covered by `automations trigger-instances list --all`',
  },
  {
    sdkPath: 'brand.update',
    reason: 'SDK alias of brand.patch, exposed as `brand update`',
  },
  {
    sdkPath: 'withBrand',
    reason:
      'client scoping helper activated by the global `--brand`; not an API command',
  },
]

/**
 * Spec operations with no CLI command yet. Kept exact: the parity test
 * fails if one of these gains SDK support without gaining a command.
 *
 * Empty as of 0.7.0: every v1 operation is bound, including the detail
 * reads, the sends root, trigger instances, trigger readiness, and the
 * run/audience-run lifecycle actions. Since 0.10.0 (SDK 11.2) every one of
 * them goes through an SDK method except the paged `api-keys list` and
 * `integrations list` reads and the `api` escape hatch.
 */
export const SPEC_SKIP_LIST: readonly SpecSkip[] = []
