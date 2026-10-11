import { describe, expect, it } from 'vitest'
import { renderTable, resolveOutputMode } from '../../src/lib/output'
import { runCli } from '../helpers/run-cli'

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
  it('handles exports larger than the function argument limit', () => {
    const rows = Array.from({ length: 150_000 }, () => ({ name: 'test' }))
    const result = renderTable(rows, [{ key: 'name', header: 'NAME' }])
    expect(result.split('\n')).toHaveLength(rows.length + 1)
  })

  it('does not evaluate human rendering in JSON mode', async () => {
    const result = await runCli(['lazy-output', '--json'], {
      extraCommands: [
        {
          path: ['lazy-output'],
          summary: 'Test lazy output',
          commandClass: 'read',
          sdkMethod: null,
          examples: ['brew-cli lazy-output'],
          run: async () => ({
            data: { ok: true },
            human: () => {
              throw new Error('human output evaluated')
            },
          }),
        },
      ],
    })
    expect(result.code).toBe(0)
    expect(result.json).toEqual({ ok: true })
  })
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
