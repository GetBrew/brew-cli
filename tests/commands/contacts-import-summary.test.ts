import type { ImportContactsResponse } from '@brew.new/sdk'
import { describe, expect, it } from 'vitest'
import {
  MAX_TERMINAL_ROWS,
  renderImportResult,
} from '../../src/commands/contacts/import-summary'

function result(
  overrides: Partial<ImportContactsResponse> = {}
): ImportContactsResponse {
  return {
    summary: { inserted: 2, updated: 0, failed: 1, skipped: 3, total: 6 },
    fieldsCreated: [],
    errors: [
      {
        email: 'grace@brewmail.dev',
        row: 5,
        code: 'FIELD_TYPE_MISMATCH',
        message: "Field 'customFields.plan' is type 'number'.",
      },
    ],
    warnings: [
      {
        code: 'CSV_ROW_SKIPPED',
        row: 2,
        message: 'Row 2 has no email address, so it was skipped.',
      },
    ],
    importId: 'imp_123',
    ...overrides,
  }
}

describe('renderImportResult (contacts import / import-csv on a terminal)', () => {
  it('leads with counts that add up to the rows, then names each row', () => {
    const text = renderImportResult(result(), 'customers.csv')
    expect(text.split('\n')[0]).toBe(
      'Imported customers.csv as imp_123: 2 added, 0 updated, 1 failed, 3 skipped (6 rows).'
    )
    expect(text).toContain('FAILED ROWS')
    expect(text).toMatch(/5\s+grace@brewmail\.dev\s+FIELD_TYPE_MISMATCH/)
    expect(text).toMatch(/2\s+CSV_ROW_SKIPPED\s+Row 2 has no email address/)
  })

  it('omits empty sections and a zero skipped count', () => {
    const text = renderImportResult(
      result({
        summary: { inserted: 1, updated: 0, failed: 0, skipped: 0, total: 1 },
        errors: [],
        warnings: [],
        fieldsCreated: ['plan'],
        validationJobId: 'val_1',
      }),
      undefined
    )
    expect(text).toBe(
      [
        'Imported as imp_123: 1 added, 0 updated, 0 failed (1 row).',
        '',
        'New custom fields: plan.',
        '',
        'Deliverability check running as validation job val_1.',
      ].join('\n')
    )
  })

  it('caps a long table and points at --json for the rest', () => {
    const errors = Array.from({ length: MAX_TERMINAL_ROWS + 5 }, (_, i) => ({
      email: `x${i}@brewmail.dev`,
      row: i + 1,
      code: 'INVALID_EMAIL',
      message: 'Invalid.',
    }))
    const text = renderImportResult(result({ errors, warnings: [] }), 'a.json')
    expect(text).toContain('… 5 more; --json prints every row.')
    expect(text).not.toContain(`x${MAX_TERMINAL_ROWS}@brewmail.dev`)
  })
})
