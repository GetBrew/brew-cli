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
      'SDK 8.0.0 issues GET on the wire for the POST-only spec operation (upstream bug); command lands when the SDK ships the POST',
  },
]

const SDK_RELEASE_GAP =
  'operation not yet in the published @brew.new/sdk (8.0.0); lands with the next SDK release — see GetBrew/typescript-sdk main'

/**
 * Spec operations with no CLI command yet. Kept exact: the parity test
 * fails if one of these gains SDK support without gaining a command.
 */
export const SPEC_SKIP_LIST: readonly SpecSkip[] = [
  {
    method: 'POST',
    path: '/v1/emails/{emailId}/accessibility-audit',
    reason:
      'SDK 8.0.0 issues GET on the wire for this POST-only operation (upstream bug); command lands when the SDK ships the POST',
  },
  { method: 'GET', path: '/v1/analytics/overview', reason: SDK_RELEASE_GAP },
  {
    method: 'POST',
    path: '/v1/audiences/from-events',
    reason: SDK_RELEASE_GAP,
  },
  {
    method: 'POST',
    path: '/v1/audiences/{audienceId}/duplicate',
    reason: SDK_RELEASE_GAP,
  },
  {
    method: 'POST',
    path: '/v1/automations/{automationId}/run',
    reason: SDK_RELEASE_GAP,
  },
  {
    method: 'GET',
    path: '/v1/automations/audience-runs',
    reason: SDK_RELEASE_GAP,
  },
  {
    method: 'POST',
    path: '/v1/automations/audience-runs/{audienceRunId}/control',
    reason: SDK_RELEASE_GAP,
  },
  { method: 'GET', path: '/v1/brands', reason: SDK_RELEASE_GAP },
  { method: 'POST', path: '/v1/brands', reason: SDK_RELEASE_GAP },
  { method: 'GET', path: '/v1/brands/{brandId}', reason: SDK_RELEASE_GAP },
  { method: 'GET', path: '/v1/chats/{chatId}', reason: SDK_RELEASE_GAP },
  {
    method: 'GET',
    path: '/v1/domains/{domainId}/health',
    reason: SDK_RELEASE_GAP,
  },
  {
    method: 'POST',
    path: '/v1/emails/{emailId}/clone',
    reason: SDK_RELEASE_GAP,
  },
  {
    method: 'POST',
    path: '/v1/emails/{emailId}/export',
    reason: SDK_RELEASE_GAP,
  },
  {
    method: 'POST',
    path: '/v1/emails/{emailId}/client-previews',
    reason: SDK_RELEASE_GAP,
  },
  {
    method: 'GET',
    path: '/v1/emails/{emailId}/inbox-placement-tests',
    reason: SDK_RELEASE_GAP,
  },
  {
    method: 'POST',
    path: '/v1/emails/{emailId}/inbox-placement-tests',
    reason: SDK_RELEASE_GAP,
  },
  { method: 'POST', path: '/v1/emails/figma', reason: SDK_RELEASE_GAP },
  {
    method: 'POST',
    path: '/v1/sends/{sendId}/pause',
    reason: SDK_RELEASE_GAP,
  },
  {
    method: 'POST',
    path: '/v1/sends/{sendId}/resume',
    reason: SDK_RELEASE_GAP,
  },
]
