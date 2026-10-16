import * as sdk from '@brew.new/sdk'
import type { HttpMethod } from './define-command'

// Older supported SDK releases do not expose the export default yet. Keep
// those clients within Brew's export budget until they gain the SDK constant.
export const EXPORT_EMAIL_DEFAULT_TIMEOUT_MS =
  'EXPORT_EMAIL_DEFAULT_TIMEOUT_MS' in sdk &&
  typeof sdk.EXPORT_EMAIL_DEFAULT_TIMEOUT_MS === 'number'
    ? sdk.EXPORT_EMAIL_DEFAULT_TIMEOUT_MS
    : 800_000

/**
 * Routes whose server work routinely outlasts the 30 s default, with the
 * SDK's own per-call default for each — one source for the numbers, so the
 * CLI never disagrees with the SDK about how long a generate may take.
 *
 * Commands declare these as `defaultTimeoutMs` (their whole-command
 * deadline), and the `api` escape hatch looks its route up here, so
 * `brew-cli api POST /v1/emails` waits as long as `emails generate` does.
 */
export const LONG_RUNNING_ROUTES: ReadonlyArray<{
  readonly method: HttpMethod
  readonly path: string
  readonly timeoutMs: number
}> = [
  {
    method: 'POST',
    path: '/v1/emails/{emailId}/export',
    timeoutMs: EXPORT_EMAIL_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'POST',
    path: '/v1/emails',
    timeoutMs: sdk.GENERATE_EMAIL_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'PATCH',
    path: '/v1/emails/{emailId}',
    timeoutMs: sdk.EDIT_EMAIL_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'POST',
    path: '/v1/emails/audit',
    timeoutMs: sdk.AUDIT_EMAIL_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'POST',
    path: '/v1/emails/{emailId}/client-previews',
    timeoutMs: sdk.PREVIEW_EMAIL_CLIENTS_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'POST',
    path: '/v1/emails/import',
    timeoutMs: sdk.IMPORT_EMAIL_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'POST',
    path: '/v1/emails/figma',
    timeoutMs: sdk.IMPORT_FIGMA_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'POST',
    path: '/v1/content/gif',
    timeoutMs: sdk.GIF_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'POST',
    path: '/v1/content/generate-image',
    timeoutMs: sdk.GENERATE_IMAGE_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'POST',
    path: '/v1/content/add-image',
    timeoutMs: sdk.ADD_IMAGE_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'PUT',
    path: '/v1/app-emails/{triggerKey}',
    timeoutMs: sdk.UPSERT_APP_EMAIL_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'POST',
    path: '/v1/app-emails/kit',
    timeoutMs: sdk.SET_UP_APP_EMAIL_KIT_DEFAULT_TIMEOUT_MS,
  },
]

/** The long-running default for a concrete request path, if it has one. */
export function longRunningTimeoutMs(input: {
  readonly method: string
  readonly path: string
}): number | undefined {
  const bare = input.path.split('?')[0] ?? input.path
  return LONG_RUNNING_ROUTES.find(
    (route) =>
      route.method === input.method && matchesTemplate(route.path, bare)
  )?.timeoutMs
}

/** `/v1/emails/{emailId}` matches `/v1/emails/eml_1`, segment for segment. */
export function matchesTemplate(template: string, path: string): boolean {
  const want = template.split('/')
  const have = path.split('/')
  return (
    want.length === have.length &&
    want.every((segment, index) =>
      segment.startsWith('{') && segment.endsWith('}')
        ? (have[index] ?? '') !== ''
        : segment === have[index]
    )
  )
}
