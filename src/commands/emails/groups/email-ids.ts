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
