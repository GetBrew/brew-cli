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
    sdkPath: 'automations.triggers.getContract',
    reason:
      'covered by `automations triggers contract get` (raw route, bound pre-SDK-v9; SDK-method migration tracked separately)',
  },
  {
    sdkPath: 'automations.triggers.putContract',
    reason:
      'covered by `automations triggers contract put` (raw route, bound pre-SDK-v9)',
  },
  {
    sdkPath: 'automations.triggers.validatePayload',
    reason:
      'covered by `automations triggers contract validate` (raw route, bound pre-SDK-v9)',
  },
  {
    sdkPath: 'payloadContracts.infer',
    reason: 'covered by `contracts infer` (raw route, bound pre-SDK-v9)',
  },
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
 * run/audience-run lifecycle actions. 0.8.0 keeps it empty by binding the
 * saved-audit, rendering-job and template reads as raw routes ahead of
 * SDK 11.
 */
export const SPEC_SKIP_LIST: readonly SpecSkip[] = []
