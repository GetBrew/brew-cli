import {
  ADD_IMAGE_DEFAULT_TIMEOUT_MS,
  AUDIT_EMAIL_DEFAULT_TIMEOUT_MS,
  EDIT_EMAIL_DEFAULT_TIMEOUT_MS,
  GENERATE_EMAIL_DEFAULT_TIMEOUT_MS,
  GENERATE_IMAGE_DEFAULT_TIMEOUT_MS,
  GIF_DEFAULT_TIMEOUT_MS,
  IMPORT_EMAIL_DEFAULT_TIMEOUT_MS,
  IMPORT_FIGMA_DEFAULT_TIMEOUT_MS,
  PREVIEW_EMAIL_CLIENTS_DEFAULT_TIMEOUT_MS,
} from '@brew.new/sdk'
import type { HttpMethod } from './define-command'

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
    path: '/v1/emails',
    timeoutMs: GENERATE_EMAIL_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'PATCH',
    path: '/v1/emails/{emailId}',
    timeoutMs: EDIT_EMAIL_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'POST',
    path: '/v1/emails/audit',
    timeoutMs: AUDIT_EMAIL_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'POST',
    path: '/v1/emails/{emailId}/client-previews',
    timeoutMs: PREVIEW_EMAIL_CLIENTS_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'POST',
    path: '/v1/emails/import',
    timeoutMs: IMPORT_EMAIL_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'POST',
    path: '/v1/emails/figma',
    timeoutMs: IMPORT_FIGMA_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'POST',
    path: '/v1/content/gif',
    timeoutMs: GIF_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'POST',
    path: '/v1/content/generate-image',
    timeoutMs: GENERATE_IMAGE_DEFAULT_TIMEOUT_MS,
  },
  {
    method: 'POST',
    path: '/v1/content/add-image',
    timeoutMs: ADD_IMAGE_DEFAULT_TIMEOUT_MS,
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
