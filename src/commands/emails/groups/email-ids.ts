import { CliUsageError } from '../../../lib/errors'

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

export function assertEmailIdsNotEmpty(value: unknown): void {
  if (Array.isArray(value) && value.length === 0) {
    throw new CliUsageError(
      '--email-ids needs at least one design id (comma-separated, up to 50).'
    )
  }
}
