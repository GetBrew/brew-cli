import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ProjectWriter } from '../../../src/lib/project/fs-writer'
import {
  ensureIgnored,
  isIgnored,
  matchesGitignore,
} from '../../../src/lib/project/gitignore'
import type { SpawnFn } from '../../../src/lib/types'
import { tempProject } from '../../helpers/fixtures'

function fakeGit(
  answers: Readonly<Record<string, number>>,
  calls: string[][] = []
): SpawnFn {
  return async (command, args) => {
    calls.push([command, ...args])
    return { code: answers[args.at(-1) ?? ''] ?? 1, stdout: '', stderr: '' }
  }
}

const enoent: SpawnFn = async () => {
  throw Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' })
}

function hasGit(): boolean {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

describe('isIgnored', () => {
  it('asks git check-ignore through the spawn seam', async () => {
    const calls: string[][] = []
    const spawn = fakeGit({ '.env.local': 0, 'brew.json': 1 }, calls)
    const cwd = tempProject()
    expect(await isIgnored('.env.local', { cwd, spawn })).toBe(true)
    expect(await isIgnored('brew.json', { cwd, spawn })).toBe(false)
    expect(calls[0]).toEqual(['git', 'check-ignore', '-q', '--', '.env.local'])
  })

  it('falls back to the .gitignore parser outside a repo or without git', async () => {
    const cwd = tempProject()
    writeFileSync(join(cwd, '.gitignore'), '.env*\n!.env.example\n')
    const notARepo: SpawnFn = async () => ({
      code: 128,
      stdout: '',
      stderr: 'fatal: not a git repository',
    })
    expect(await isIgnored('.env.local', { cwd, spawn: notARepo })).toBe(true)
    expect(await isIgnored('.env.example', { cwd, spawn: enoent })).toBe(false)
    rmSync(join(cwd, '.gitignore'))
    expect(await isIgnored('.env.local', { cwd, spawn: enoent })).toBe(false)
  })

  it.runIf(hasGit())('agrees with a real git repository', async () => {
    const cwd = tempProject()
    rmSync(join(cwd, '.git'), { recursive: true })
    execFileSync('git', ['init', '-q'], { cwd })
    writeFileSync(join(cwd, '.gitignore'), '.env*.local\n')
    expect(await isIgnored('.env.local', { cwd })).toBe(true)
    expect(await isIgnored('brew.json', { cwd })).toBe(false)
  })
})

describe('matchesGitignore (fallback parser)', () => {
  const cases: Array<[string, string, boolean]> = [
    ['.env*', '.env.local', true],
    ['.env*', 'apps/web/.env.local', true],
    ['/.env', 'apps/web/.env', false],
    ['/.env', '.env', true],
    ['*.log\n!keep.log', 'keep.log', false],
    ['*.log\n!keep.log', 'debug.log', true],
    ['secrets/', 'secrets/key.pem', true],
    ['secrets/', 'secrets', false],
    ['node_modules', 'node_modules/x/index.js', true],
    ['build/\n!build/keep.txt', 'build/keep.txt', true],
    ['apps/**/.env', 'apps/web/deep/.env', true],
    ['**/dist', 'packages/ui/dist/index.js', true],
    ['config/*.json', 'config/a.json', true],
    ['config/*.json', 'config/nested/a.json', false],
    ['# comment\n\n.env.[lp]*', '.env.local', true],
    ['\\#hash', '#hash', true],
  ]
  for (const [rules, path, expected] of cases) {
    it(`${JSON.stringify(rules)} ${expected ? 'ignores' : 'keeps'} ${path}`, () => {
      expect(matchesGitignore(rules, path)).toBe(expected)
    })
  }
})

describe('ensureIgnored', () => {
  it('adds only what git does not ignore, inside a managed block', async () => {
    const root = tempProject()
    writeFileSync(join(root, '.gitignore'), 'node_modules\n.env\n')
    const writer = new ProjectWriter({ root })
    const result = await ensureIgnored(writer, ['.env', '.env.local'], {
      spawn: enoent,
    })
    expect(result.added).toEqual(['.env.local'])
    expect(result.change?.action).toBe('updated')
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toBe(
      'node_modules\n.env\n\n# brew:start\n.env.local\n# brew:end\n'
    )
    // Re-running: the fallback parser now sees the block → nothing to do.
    const again = await ensureIgnored(writer, ['.env', '.env.local'], {
      spawn: enoent,
    })
    expect(again).toEqual({ added: [], conflicts: [] })
  })

  it('extends an existing block and creates a missing .gitignore', async () => {
    const root = tempProject()
    const writer = new ProjectWriter({ root })
    await ensureIgnored(writer, ['.env.local'], { spawn: fakeGit({}) })
    await ensureIgnored(writer, ['.brew/cache'], { spawn: fakeGit({}) })
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toBe(
      '# brew:start\n.env.local\n.brew/cache\n# brew:end\n'
    )
  })

  it('reports a path a later rule re-includes as a conflict, not added', async () => {
    const root = tempProject()
    writeFileSync(
      join(root, '.gitignore'),
      '# brew:start\n# brew:end\n!.env.local\n'
    )
    for (const dryRun of [true, false]) {
      const result = await ensureIgnored(
        new ProjectWriter({ root, dryRun }),
        ['.env.local'],
        { spawn: enoent }
      )
      expect(result.added).toEqual([])
      expect(result.conflicts).toEqual(['.env.local'])
    }
  })

  it('reports paths as conflicts when the .gitignore write is refused', async () => {
    const root = tempProject()
    const outside = tempProject('brew-cli-outside-')
    writeFileSync(join(outside, '.gitignore'), 'node_modules\n')
    symlinkSync(join(outside, '.gitignore'), join(root, '.gitignore'))
    for (const dryRun of [true, false]) {
      const result = await ensureIgnored(
        new ProjectWriter({ root, dryRun }),
        ['.env.local'],
        { spawn: enoent }
      )
      expect(result.change?.action).toBe('refused')
      expect(result.added).toEqual([])
      expect(result.conflicts).toEqual(['.env.local'])
    }
  })

  it('plans without writing in dry-run mode', async () => {
    const root = tempProject()
    const writer = new ProjectWriter({ root, dryRun: true })
    const result = await ensureIgnored(writer, ['.env.local'], {
      spawn: fakeGit({}),
    })
    expect(result.change?.action).toBe('created')
    expect(result.added).toEqual(['.env.local'])
    expect(() => readFileSync(join(root, '.gitignore'))).toThrow()
  })
})
