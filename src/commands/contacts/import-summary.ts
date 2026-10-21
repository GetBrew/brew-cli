import type { ImportContactsResponse } from '@brew.new/sdk'
import { renderTable } from '../../lib/output'

/** Rows of each table a terminal shows before pointing at `--json`. */
export const MAX_TERMINAL_ROWS = 20

/**
 * The terminal rendering of `contacts import` and `contacts import-csv`: one
 * line of counts, then the failures and warnings returned by the API.
 * `--json` prints the full envelope. A dry run (`--dry-run`) says so first
 * and counts what the import would do.
 */
export function renderImportResult(
  result: ImportContactsResponse,
  fileName: string | undefined
): string {
  const { summary } = result
  const isDryRun = result.dryRun === true
  const counts = [
    `${summary.inserted} ${isDryRun ? 'to add' : 'added'}`,
    `${summary.updated} ${isDryRun ? 'to update' : 'updated'}`,
    `${summary.failed} ${isDryRun ? 'to fail' : 'failed'}`,
    ...(summary.skipped > 0
      ? [`${summary.skipped} ${isDryRun ? 'to skip' : 'skipped'}`]
      : []),
  ].join(', ')
  const name = fileName ? `${fileName} ` : ''
  const rowNoun = summary.total === 1 ? 'row' : 'rows'
  const lines = [
    isDryRun
      ? `Dry run${fileName ? ` of ${fileName}` : ''} — nothing was written: ${counts} (${summary.total} ${rowNoun} submitted).`
      : `Imported ${name}as ${result.importId}: ${counts} (${summary.total} ${rowNoun} submitted).`,
  ]
  if (result.errors.length > 0) {
    lines.push(
      '',
      'FAILED ROWS',
      limitedTable(result.errors, [
        { key: 'row', header: 'ROW' },
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
        { key: 'row', header: 'ROW' },
        { key: 'email', header: 'EMAIL' },
        { key: 'code', header: 'CODE' },
        { key: 'field', header: 'FIELD' },
        { key: 'message', header: 'MESSAGE' },
      ])
    )
  }
  if (result.fieldsCreated.length > 0) {
    lines.push(
      '',
      `${isDryRun ? 'Custom fields it would create' : 'New custom fields'}: ${result.fieldsCreated.join(', ')}.`
    )
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
    ? `${table}\n… ${hidden} more; --json prints the full response.`
    : table
}
