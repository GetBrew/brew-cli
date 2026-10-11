import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  detectFramework,
  expandBraces,
  findMonorepo,
  listWorkspacePackages,
  parsePnpmWorkspaceYaml,
  resolveProjectRoot,
} from '../../../src/lib/project/monorepo'
import { copyFixture } from '../../helpers/fixtures'

describe('resolveProjectRoot', () => {
  it('resolves a pnpm + Turborepo workspace app from deep inside it', () => {
    const root = copyFixture('pnpm-turbo')
    const resolved = resolveProjectRoot(join(root, 'apps/web/app'))
    expect(resolved.root).toBe(join(root, 'apps/web'))
    expect(resolved.monorepo).toEqual({
      tool: 'turbo',
      root,
      workspace: { name: 'web', dir: 'apps/web' },
      patterns: ['apps/*', 'packages/*', '!packages/private'],
    })
    expect(resolved.candidates).toEqual([
      { name: 'api', dir: 'apps/api', framework: 'hono' },
      { name: 'web', dir: 'apps/web', framework: 'next' },
    ])
  })

  it('stays at the monorepo root, listing every app candidate', () => {
    const root = copyFixture('pnpm-turbo')
    const resolved = resolveProjectRoot(root)
    expect(resolved.root).toBe(root)
    expect(resolved.monorepo?.workspace).toBeNull()
    expect(resolved.candidates.map((candidate) => candidate.name)).toEqual([
      'api',
      'web',
    ])
  })

  it('reads npm workspaces and skips packages with no framework', () => {
    const root = copyFixture('npm-workspaces')
    const resolved = resolveProjectRoot(join(root, 'apps/docs'))
    expect(resolved.monorepo).toMatchObject({
      tool: 'workspaces',
      root,
      workspace: { name: 'docs', dir: 'apps/docs' },
    })
    expect(resolved.candidates).toEqual([
      { name: 'site', dir: 'apps/site', framework: 'astro' },
    ])
  })

  it('treats nx.json as a monorepo with the conventional app folders', () => {
    const root = copyFixture('nx')
    const resolved = resolveProjectRoot(root)
    expect(resolved.monorepo).toMatchObject({
      tool: 'nx',
      patterns: ['apps/*', 'packages/*', 'libs/*'],
    })
    expect(resolved.candidates).toEqual([
      { name: 'shop', dir: 'apps/shop', framework: 'next' },
    ])
  })

  it('resolves a single app to its own package', () => {
    const root = copyFixture('next-app')
    mkdirSync(join(root, 'src/app'), { recursive: true })
    expect(resolveProjectRoot(join(root, 'src/app'))).toEqual({
      root,
      monorepo: null,
      candidates: [{ name: 'next-app', dir: '.', framework: 'next' }],
    })
  })

  it('falls back to the cwd when there is no package.json up to the repo', () => {
    const root = copyFixture('no-package-json')
    expect(resolveProjectRoot(root)).toEqual({
      root,
      monorepo: null,
      candidates: [],
    })
  })

  it('never mistakes a package-level turbo.json for the root', () => {
    const root = copyFixture('pnpm-turbo')
    expect(findMonorepo(join(root, 'apps/web'))?.root).toBe(root)
  })
})

describe('workspace helpers', () => {
  it('parses pnpm-workspace.yaml lists (block and inline)', () => {
    expect(
      parsePnpmWorkspaceYaml(
        'packages:\n  - \'apps/*\'\n  - "packages/**" # all\ncatalog:\n  react: 19\n'
      )
    ).toEqual(['apps/*', 'packages/**'])
    expect(parsePnpmWorkspaceYaml('packages: [\'a/*\', "b"]\n')).toEqual([
      'a/*',
      'b',
    ])
  })

  it('expands ** globs and honours negations', () => {
    const root = copyFixture('pnpm-turbo')
    mkdirSync(join(root, 'packages/private'), { recursive: true })
    writeFileSync(join(root, 'packages/private/package.json'), '{}')
    mkdirSync(join(root, 'packages/nested/deep'), { recursive: true })
    writeFileSync(
      join(root, 'packages/nested/deep/package.json'),
      '{"name":"deep"}'
    )
    expect(
      listWorkspacePackages(root, ['packages/**', '!packages/private'])
    ).toEqual([
      { name: 'deep', dir: 'packages/nested/deep' },
      { name: '@acme/ui', dir: 'packages/ui' },
    ])
  })

  it('expands brace patterns', () => {
    expect(expandBraces('{apps,packages}/*')).toEqual(['apps/*', 'packages/*'])
    expect(expandBraces('a/{b,{c,d}}/e')).toEqual(['a/b/e', 'a/c/e', 'a/d/e'])
    expect(expandBraces('{x,y}/{1,2}')).toEqual(['x/1', 'x/2', 'y/1', 'y/2'])
    expect(expandBraces('plain/*')).toEqual(['plain/*'])
    expect(expandBraces('odd/{one}/x')).toEqual(['odd/{one}/x'])
    expect(expandBraces('open/{a,b')).toEqual(['open/{a,b'])
    const root = copyFixture('pnpm-turbo')
    expect(
      listWorkspacePackages(root, ['{apps,packages}/*']).map((pkg) => pkg.dir)
    ).toEqual(['apps/api', 'apps/web', 'packages/ui'])
  })

  it('names a framework by its most specific dependency', () => {
    expect(
      detectFramework({ dependencies: { react: '19', next: '16', vite: '6' } })
    ).toBe('next')
    expect(detectFramework({ devDependencies: { vite: '6' } })).toBe('vite')
    expect(detectFramework({ dependencies: { lodash: '4' } })).toBeNull()
    expect(detectFramework(null)).toBeNull()
  })
})
