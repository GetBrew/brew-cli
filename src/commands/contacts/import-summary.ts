import type { ImportContactsResponse } from '@brew.new/sdk'
import { renderTable } from '../../lib/output'

/** Rows of each table a terminal shows before pointing at `--json`. */
export const MAX_TERMINAL_ROWS = 20

/**
 * The terminal rendering of `contacts import` and `contacts import-csv`: one
 * line of counts, then the failures and warnings returned by the API.
 * `--json` prints the full envelope.
 */
export function renderImportResult(
  result: ImportContactsResponse,
  fileName: string | undefined
): string {
  const { summary } = result
  const counts = [
    `${summary.inserted} added`,
    `${summary.updated} updated`,
    `${summary.failed} failed`,
    ...(summary.skipped > 0 ? [`${summary.skipped} skipped`] : []),
  ].join(', ')
  const name = fileName ? `${fileName} ` : ''
  const lines = [`Imported ${name}as ${result.importId}: ${counts}.`]
  if (result.errors.length > 0) {
    lines.push(
      '',
      'FAILED ROWS',
      limitedTable(result.errors, [
        { key: 'email', header: 'EMAIL' },
        { key: 'code', header: 'CODE' },
        { key: 'field', header: 'FIELD' },
        { key: 'message', header: 'MESSAGE' },
      ])
    )
  }
  if (result.warnings.length > 0) {
    lines.push(
      '',
      'WARNINGS',
      limitedTable(result.warnings, [
        { key: 'email', header: 'EMAIL' },
        { key: 'code', header: 'CODE' },
        { key: 'field', header: 'FIELD' },
        { key: 'message', header: 'MESSAGE' },
      ])
    )
  }
  if (result.fieldsCreated.length > 0) {
    lines.push('', `New custom fields: ${result.fieldsCreated.join(', ')}.`)
  }
  if (result.validation) {
    const { valid, risky, invalid, unscored, persistence } = result.validation
    lines.push(
      '',
      'DELIVERABILITY CHECK',
      `${valid} valid, ${risky} risky, ${invalid} invalid, ${unscored} unscored.`
    )
    if (persistence) {
      lines.push(
        `Saved results: ${persistence.matched} matched, ${persistence.modified} updated, ${persistence.failed} failed to save.`
      )
    }
  }
  if (result.validationJobId) {
    lines.push(
      '',
      `Deliverability check running as validation job ${result.validationJobId}.`
    )
  }
  return lines.join('\n')
}

function limitedTable(
  rows: ReadonlyArray<object>,
  columns: Parameters<typeof renderTable>[1]
): string {
  const shown = rows.slice(0, MAX_TERMINAL_ROWS) as ReadonlyArray<
    Record<string, unknown>
  >
  const table = renderTable(shown, columns)
  const hidden = rows.length - shown.length
  return hidden > 0
    ? `${table}\n… ${hidden} more; --json prints every row.`
    : table
}
