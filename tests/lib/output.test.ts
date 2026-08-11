import { describe, expect, it } from 'vitest'
import { renderTable, resolveOutputMode } from '../../src/lib/output'

describe('resolveOutputMode', () => {
  it('is human only on a TTY without --json', () => {
    expect(resolveOutputMode({ isJsonFlag: false, isTtyOut: true })).toBe(
      'human'
    )
    expect(resolveOutputMode({ isJsonFlag: false, isTtyOut: false })).toBe(
      'json'
    )
    expect(resolveOutputMode({ isJsonFlag: true, isTtyOut: true })).toBe('json')
    expect(resolveOutputMode({ isJsonFlag: true, isTtyOut: false })).toBe(
      'json'
    )
  })
})

describe('renderTable', () => {
  it('aligns columns and stringifies non-scalar cells', () => {
    const table = renderTable(
      [
        { name: 'welcome', status: 'sent', meta: { opens: 2 } },
        { name: 'digest-weekly', status: 'draft', meta: null },
      ],
      [
        { key: 'name', header: 'NAME' },
        { key: 'status', header: 'STATUS' },
        { key: 'meta', header: 'META' },
      ]
    )
    expect(table).toBe(
      [
        'NAME           STATUS  META',
        'welcome        sent    {"opens":2}',
        'digest-weekly  draft',
      ].join('\n')
    )
  })
})
