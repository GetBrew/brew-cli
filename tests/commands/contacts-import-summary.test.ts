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
  it('renders submitted totals, failed row positions and warning fields', () => {
    const text = renderImportResult(result(), 'customers.csv')
    expect(text.split('\n')[0]).toBe(
      'Imported customers.csv as imp_123: 2 added, 0 updated, 1 failed, 3 skipped (6 rows submitted).'
    )
    expect(text).toContain('FAILED ROWS')
    expect(text).toMatch(
      /5\s+grace@brewmail\.dev\s+FIELD_TYPE_MISMATCH\s+customFields.plan/
    )
    expect(text).toMatch(
      /CSV_COLUMN_IGNORED\s+Created At\s+Created At is managed/
    )
    expect(text).not.toContain('undefined')
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
        'Imported as imp_123: 1 added, 0 updated, 0 failed (1 row submitted).',
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
    const text = renderImportResult(
      result({
        summary: { inserted: 0, updated: 0, failed: 25, skipped: 0, total: 25 },
        errors,
        warnings: [],
      }),
      'a.json'
    )
    expect(text).toContain('… 5 more; --json prints the full response.')
    expect(text).not.toContain(`x${MAX_TERMINAL_ROWS}@brewmail.dev`)
  })

  it('caps skipped-row details without promising every skipped row in JSON', () => {
    const text = renderImportResult(
      result({
        summary: {
          inserted: 1,
          updated: 0,
          failed: 0,
          skipped: 150,
          total: 151,
        },
        errors: [],
        warnings: [
          ...Array.from({ length: 100 }, (_, index) => ({
            row: index + 1,
            code: 'CSV_ROW_SKIPPED',
            message: `Row ${index + 1} has no email address, so it was skipped.`,
          })),
          {
            code: 'CSV_ROW_SKIPPED',
            message:
              '50 more rows were skipped; only the first 100 are listed.',
          },
        ],
      }),
      undefined
    )
    expect(text).toMatch(/2\s+CSV_ROW_SKIPPED\s+Row 2 has no email address/)
    expect(text).toContain('150 skipped (151 rows submitted).')
    expect(text).toContain('… 81 more; --json prints the full response.')
    expect(text).not.toContain('every row')
    expect(text).not.toContain('undefined')
  })

  it('shows completed deliverability outcomes and failed saves on a terminal', () => {
    const text = renderImportResult(
      result({
        validation: {
          valid: 2,
          risky: 1,
          invalid: 3,
          unscored: 4,
          persistence: { matched: 6, modified: 5, failed: 1 },
        },
      }),
      undefined
    )
    expect(text).toContain('DELIVERABILITY CHECK')
    expect(text).toContain('2 valid, 1 risky, 3 invalid, 4 unscored.')
    expect(text).toContain(
      'Saved results: 6 matched, 5 updated, 1 failed to save.'
    )
  })

  it('shows completed outcomes when persistence details are absent', () => {
    const text = renderImportResult(
      result({ validation: { valid: 1, risky: 0, invalid: 0, unscored: 0 } }),
      undefined
    )
    expect(text).toContain('1 valid, 0 risky, 0 invalid, 0 unscored.')
    expect(text).not.toContain('Saved results:')
  })
})
