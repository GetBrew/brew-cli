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
    summary: { inserted: 2, updated: 0, failed: 1, skipped: 3 },
    fieldsCreated: [],
    errors: [
      {
        email: 'grace@brewmail.dev',
        code: 'FIELD_TYPE_MISMATCH',
        field: 'customFields.plan',
        message: "Field 'customFields.plan' is type 'number'.",
      },
    ],
    warnings: [
      {
        code: 'CSV_COLUMN_IGNORED',
        field: 'Created At',
        message: 'Created At is managed by Brew and was ignored.',
      },
    ],
    importId: 'imp_123',
    ...overrides,
  }
}

describe('renderImportResult (contacts import / import-csv on a terminal)', () => {
  it('renders API counts, failed addresses and warning fields without requiring row indexes', () => {
    const text = renderImportResult(result(), 'customers.csv')
    expect(text.split('\n')[0]).toBe(
      'Imported customers.csv as imp_123: 2 added, 0 updated, 1 failed, 3 skipped.'
    )
    expect(text).toContain('FAILED ROWS')
    expect(text).toMatch(
      /grace@brewmail\.dev\s+FIELD_TYPE_MISMATCH\s+customFields.plan/
    )
    expect(text).toMatch(
      /CSV_COLUMN_IGNORED\s+Created At\s+Created At is managed/
    )
  })

  it('omits empty sections and a zero skipped count', () => {
    const text = renderImportResult(
      result({
        summary: { inserted: 1, updated: 0, failed: 0, skipped: 0 },
        errors: [],
        warnings: [],
        fieldsCreated: ['plan'],
        validationJobId: 'val_1',
      }),
      undefined
    )
    expect(text).toBe(
      [
        'Imported as imp_123: 1 added, 0 updated, 0 failed.',
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
      code: 'INVALID_EMAIL',
      message: 'Invalid.',
    }))
    const text = renderImportResult(result({ errors, warnings: [] }), 'a.json')
    expect(text).toContain('… 5 more; --json prints every row.')
    expect(text).not.toContain(`x${MAX_TERMINAL_ROWS}@brewmail.dev`)
  })
})
