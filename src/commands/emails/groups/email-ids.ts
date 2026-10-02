import { CliUsageError } from '../../../lib/errors'

/**
 * `--email-ids eml_1,eml_2` on a group write: the designs to move into the
 * folder in the same call (up to 50; the API validates the ids and the
 * count). An array from `--input` passes through unchanged.
 */
export const EMAIL_IDS_FLAG = {
  flag: '--email-ids <ids>',
  summary:
    'Comma-separated design ids to move into the folder (up to 50); answers moved / notMoved',
} as const

export function toEmailIds(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }
  return value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '')
}

/**
 * An EMPTY list (`--email-ids ','`, or `emailIds: []` via --input) is refused
 * here, before anything is sent: the API needs at least one id, and beside a
 * valid `--name` the empty list would turn the rename into an API error.
 */
export function assertEmailIdsNotEmpty(value: unknown): void {
  if (Array.isArray(value) && value.length === 0) {
    throw new CliUsageError(
      '--email-ids needs at least one design id (comma-separated, up to 50).'
    )
  }
}
