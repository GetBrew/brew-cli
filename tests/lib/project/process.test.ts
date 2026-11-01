import { describe, expect, it } from 'vitest'
import { windowsCommandLine } from '../../../src/lib/project/process'

describe('windowsCommandLine', () => {
  it('quotes every argument so cmd.exe passes it through', () => {
    expect(
      windowsCommandLine('npm', ['install', '@brew.new/sdk@^13.3.0', 'a&b'])
    ).toBe('"npm" "install" "@brew.new/sdk@^13.3.0" "a&b"')
    expect(windowsCommandLine('git', ['C:\\dir\\'])).toBe('"git" "C:\\dir\\\\"')
  })

  it('refuses what cmd.exe would change inside quotes', () => {
    for (const arg of ['say "hi"', '%PATH%', 'a\nb']) {
      expect(() => windowsCommandLine('npm', [arg])).toThrow(/cmd\.exe/)
    }
  })
})
