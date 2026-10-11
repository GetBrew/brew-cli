import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { unifiedDiff } from '../../../src/lib/project/diff'
import {
  HASH_BLOCK_MARKERS,
  ProjectWriter,
  readBlock,
  sha256Hex,
} from '../../../src/lib/project/fs-writer'
import { tempProject } from '../../helpers/fixtures'

describe('ProjectWriter.writeFile (create-only)', () => {
  it('creates a missing file, nested directories included', () => {
    const root = tempProject()
    const writer = new ProjectWriter({ root })
    const change = writer.writeFile('lib/brew.ts', 'export {}\n')
    expect(change).toMatchObject({
      path: 'lib/brew.ts',
      action: 'created',
      sha256: sha256Hex('export {}\n'),
    })
    expect(change.diff).toContain('+export {}')
    expect(readFileSync(join(root, 'lib/brew.ts'), 'utf8')).toBe('export {}\n')
  })

  it('leaves identical content alone, CRLF checkouts included', () => {
    const root = tempProject()
    writeFileSync(join(root, 'a.ts'), 'one\r\ntwo\r\n')
    const writer = new ProjectWriter({ root })
    expect(writer.writeFile('a.ts', 'one\ntwo\n').action).toBe('unchanged')
    expect(readFileSync(join(root, 'a.ts'), 'utf8')).toBe('one\r\ntwo\r\n')
  })

  it('keeps the user version of a file it did not write', () => {
    const root = tempProject()
    writeFileSync(join(root, 'a.ts'), 'mine\n')
    const change = new ProjectWriter({ root }).writeFile('a.ts', 'ours\n')
    expect(change).toMatchObject({
      action: 'kept-user-version',
      sha256: sha256Hex('mine\n'),
    })
    expect(readFileSync(join(root, 'a.ts'), 'utf8')).toBe('mine\n')
  })

  it('replaces its own untouched file (hash match), keeping line endings', () => {
    const root = tempProject()
    writeFileSync(join(root, 'a.ts'), 'v1\r\n')
    const change = new ProjectWriter({ root }).writeFile('a.ts', 'v2\n', {
      managedSha256: sha256Hex('v1\n'),
    })
    expect(change.action).toBe('updated')
    expect(readFileSync(join(root, 'a.ts'), 'utf8')).toBe('v2\r\n')
  })

  it('keeps a managed file the user edited since', () => {
    const root = tempProject()
    writeFileSync(join(root, 'a.ts'), 'v1 edited\n')
    const change = new ProjectWriter({ root }).writeFile('a.ts', 'v2\n', {
      managedSha256: sha256Hex('v1\n'),
    })
    expect(change).toMatchObject({
      action: 'kept-user-version',
      note: 'edited since the CLI wrote it',
    })
  })

  it('writes secrets with mode 0600, atomically (no temp files left)', () => {
    const root = tempProject()
    new ProjectWriter({ root }).writeFile('.env.local', 'A=1\n', {
      mode: 0o600,
    })
    expect(statSync(join(root, '.env.local')).mode & 0o777).toBe(0o600)
    expect(
      readdirSync(root).filter((name) => name.includes('brew-tmp'))
    ).toEqual([])
  })

  it('collects the plan without writing in dry-run mode', () => {
    const root = tempProject()
    writeFileSync(join(root, 'merged.json'), '{"a":1}\n')
    const writer = new ProjectWriter({ root, dryRun: true })
    writer.writeFile('new.ts', 'x\n')
    writer.writeFile('merged.json', '{"a":1,"b":2}\n', { overwrite: true })
    expect(
      writer.changes.map((change) => [change.path, change.action])
    ).toEqual([
      ['new.ts', 'created'],
      ['merged.json', 'updated'],
    ])
    expect(writer.changes[1]?.diff).toContain('+{"a":1,"b":2}')
    expect(existsSync(join(root, 'new.ts'))).toBe(false)
    expect(readFileSync(join(root, 'merged.json'), 'utf8')).toBe('{"a":1}\n')
  })

  it('writes through a symbolic link instead of replacing it', () => {
    const root = tempProject()
    const dotfiles = tempProject('brew-cli-dotfiles-')
    writeFileSync(join(dotfiles, 'mcp.json'), '{"a":1}\n')
    symlinkSync(join(dotfiles, 'mcp.json'), join(root, 'mcp.json'))
    symlinkSync(join(dotfiles, 'missing.json'), join(root, 'dangling.json'))
    const writer = new ProjectWriter({ root })
    expect(
      writer.writeFile('mcp.json', '{"a":2}\n', { overwrite: true }).action
    ).toBe('updated')
    expect(lstatSync(join(root, 'mcp.json')).isSymbolicLink()).toBe(true)
    expect(readFileSync(join(dotfiles, 'mcp.json'), 'utf8')).toBe('{"a":2}\n')
    expect(writer.writeFile('dangling.json', 'x\n').action).toBe('created')
    expect(lstatSync(join(root, 'dangling.json')).isSymbolicLink()).toBe(true)
    expect(readFileSync(join(dotfiles, 'missing.json'), 'utf8')).toBe('x\n')
  })

  it('never puts sensitive content in a diff', () => {
    const root = tempProject()
    const writer = new ProjectWriter({ root, dryRun: true })
    const secret = writer.writeFile('.env.local', 'KEY=brew_secret\n', {
      sensitive: true,
    })
    const block = writer.upsertBlock('.env', 'KEY=brew_secret', {
      markers: HASH_BLOCK_MARKERS,
      sensitive: true,
    })
    expect(secret.diff).toBeUndefined()
    expect(block.diff).toBeUndefined()
    expect(JSON.stringify(writer.changes)).not.toContain('brew_secret')
  })

  it('refuses relative paths that escape the root', () => {
    const writer = new ProjectWriter({ root: tempProject() })
    expect(() => writer.writeFile('../outside.ts', 'x')).toThrow(
      /outside the project root/
    )
  })

  it('inspects managed files: unchanged, edited, missing', () => {
    const root = tempProject()
    writeFileSync(join(root, 'a.ts'), 'v1\n')
    writeFileSync(join(root, 'b.ts'), 'edited\n')
    const writer = new ProjectWriter({ root })
    expect(writer.inspectManaged('a.ts', sha256Hex('v1\n')).action).toBe(
      'unchanged'
    )
    expect(writer.inspectManaged('b.ts', sha256Hex('v1\n')).action).toBe(
      'kept-user-version'
    )
    expect(writer.inspectManaged('c.ts', sha256Hex('v1\n')).action).toBe(
      'missing'
    )
  })
})

describe('ProjectWriter.upsertBlock', () => {
  it('appends a marked block, leaving the rest of the file intact', () => {
    const root = tempProject()
    writeFileSync(join(root, 'AGENTS.md'), '# Rules\n\nBe kind.\n')
    const change = new ProjectWriter({ root }).upsertBlock(
      'AGENTS.md',
      'Use Brew for email.'
    )
    expect(change.action).toBe('updated')
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toBe(
      '# Rules\n\nBe kind.\n\n<!-- brew:start -->\nUse Brew for email.\n<!-- brew:end -->\n'
    )
  })

  it('replaces only the block on re-run, and is a no-op when equal', () => {
    const root = tempProject()
    writeFileSync(
      join(root, 'AGENTS.md'),
      'top\n<!-- brew:start -->\nold\n<!-- brew:end -->\nbottom\n'
    )
    const writer = new ProjectWriter({ root })
    expect(writer.upsertBlock('AGENTS.md', 'new\nlines').action).toBe('updated')
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toBe(
      'top\n<!-- brew:start -->\nnew\nlines\n<!-- brew:end -->\nbottom\n'
    )
    expect(writer.upsertBlock('AGENTS.md', 'new\nlines\n').action).toBe(
      'unchanged'
    )
  })

  it('keeps CRLF files CRLF and supports # markers', () => {
    const root = tempProject()
    writeFileSync(
      join(root, '.gitignore'),
      'node_modules\r\n# brew:start\r\nold\r\n# brew:end\r\n'
    )
    new ProjectWriter({ root }).upsertBlock('.gitignore', '.env.local', {
      markers: HASH_BLOCK_MARKERS,
    })
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toBe(
      'node_modules\r\n# brew:start\r\n.env.local\r\n# brew:end\r\n'
    )
  })

  it('creates the file, or reports it missing when told not to', () => {
    const root = tempProject()
    const writer = new ProjectWriter({ root })
    expect(
      writer.upsertBlock('CLAUDE.md', 'x', { createIfMissing: false }).action
    ).toBe('missing')
    expect(existsSync(join(root, 'CLAUDE.md'))).toBe(false)
    expect(writer.upsertBlock('docs/AGENTS.md', 'x').action).toBe('created')
    expect(readFileSync(join(root, 'docs/AGENTS.md'), 'utf8')).toBe(
      '<!-- brew:start -->\nx\n<!-- brew:end -->\n'
    )
  })

  it('keeps a file whose markers do not pair up', () => {
    const root = tempProject()
    mkdirSync(join(root, 'docs'))
    const text = '<!-- brew:start -->\nno end\n'
    writeFileSync(join(root, 'docs/x.md'), text)
    const change = new ProjectWriter({ root }).upsertBlock('docs/x.md', 'y')
    expect(change.action).toBe('kept-user-version')
    expect(change.note).toMatch(/unbalanced/)
    expect(readFileSync(join(root, 'docs/x.md'), 'utf8')).toBe(text)
  })

  it('reads a block back', () => {
    expect(
      readBlock(
        'a\r\n# brew:start\r\nx\r\ny\r\n# brew:end\r\n',
        HASH_BLOCK_MARKERS
      )
    ).toBe('x\ny')
    expect(readBlock('no block')).toBeNull()
  })
})

describe('unifiedDiff', () => {
  it('is empty for equal texts (line endings ignored)', () => {
    expect(unifiedDiff('a\nb\n', 'a\r\nb\r\n')).toBe('')
  })

  it('renders hunks with context and line numbers', () => {
    const before = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].join(
      '\n'
    )
    const after = ['1', '2', '3', '4', 'five', '6', '7', '8', '9', '10'].join(
      '\n'
    )
    expect(unifiedDiff(before, after, { fromPath: 'n.txt' })).toBe(
      [
        '--- n.txt',
        '+++ n.txt',
        '@@ -2,7 +2,7 @@',
        ' 2',
        ' 3',
        ' 4',
        '-5',
        '+five',
        ' 6',
        ' 7',
        ' 8',
        '',
      ].join('\n')
    )
  })

  it('diffs a new file against nothing', () => {
    expect(unifiedDiff('', 'a\nb\n', { fromPath: 'x' })).toBe(
      '--- x\n+++ x\n@@ -0,0 +1,2 @@\n+a\n+b\n'
    )
  })

  it('splits distant changes into separate hunks', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `l${i + 1}`)
    const changed = [...lines]
    changed[1] = 'X'
    changed[27] = 'Y'
    const diff = unifiedDiff(lines.join('\n'), changed.join('\n'))
    expect(diff.match(/^@@/gm)).toHaveLength(2)
  })
})
