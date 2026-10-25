import { describe, expect, it } from 'vitest'
import {
  detectProject,
  type ProjectDetection,
} from '../../../src/lib/init/detect'
import { copyFixture } from '../../helpers/fixtures'

function project(name: string): ProjectDetection {
  const result = detectProject(copyFixture(name), { env: {} })
  if (result.kind !== 'project') {
    throw new Error(`${name}: expected a project, got ${result.kind}`)
  }
  return result.project
}

type Expected = Partial<
  Pick<
    ProjectDetection,
    | 'framework'
    | 'runtime'
    | 'auth'
    | 'authVersion'
    | 'libDir'
    | 'typescript'
    | 'esm'
    | 'builder'
    | 'hasPackageJson'
    | 'nextMajor'
  >
> & { readonly pm?: string }

const MATRIX: ReadonlyArray<readonly [string, Expected]> = [
  [
    'next-better-auth',
    {
      framework: 'next-app',
      auth: 'better-auth',
      authVersion: null,
      pm: 'npm',
      libDir: 'lib',
      typescript: true,
      nextMajor: 16,
      runtime: 'node',
    },
  ],
  [
    'next-pages-authjs-v4',
    {
      framework: 'next-pages',
      auth: 'authjs',
      authVersion: 'v4',
      pm: 'pnpm',
      libDir: 'lib',
    },
  ],
  [
    'next-app-authjs-v5',
    {
      framework: 'next-app',
      auth: 'authjs',
      authVersion: 'v5',
      pm: 'yarn',
      libDir: 'src/lib',
      nextMajor: 15,
    },
  ],
  [
    'vite-supabase-lovable',
    {
      framework: 'vite-react',
      auth: 'supabase',
      runtime: 'browser',
      libDir: null,
      builder: 'lovable',
      pm: 'npm',
    },
  ],
  [
    'react-router-clerk',
    {
      framework: 'react-router',
      auth: 'clerk',
      libDir: 'app/lib',
      esm: true,
    },
  ],
  [
    'sveltekit',
    {
      framework: 'sveltekit',
      auth: 'none',
      pm: 'pnpm',
      libDir: 'src/lib/server',
    },
  ],
  [
    'astro',
    { framework: 'astro', auth: 'none', libDir: 'src/lib', typescript: false },
  ],
  [
    'express-resend',
    {
      framework: 'express',
      auth: 'none',
      esm: true,
      libDir: 'src/lib',
      runtime: 'node',
    },
  ],
  [
    'hono-workers',
    { framework: 'hono', runtime: 'workers', libDir: 'src/lib' },
  ],
  ['bun', { framework: 'hono', runtime: 'node', pm: 'bun', libDir: 'lib' }],
  [
    'supabase-functions',
    {
      framework: 'supabase-functions',
      auth: 'supabase',
      runtime: 'deno',
      hasPackageJson: false,
      libDir: 'supabase/functions/_shared',
    },
  ],
  [
    'next-firebase',
    { framework: 'next-app', auth: 'firebase', libDir: 'src/lib' },
  ],
  ['react-email', { framework: 'express', auth: 'none' }],
  ['yarn-berry-pnp', { framework: 'react-router', auth: 'none', pm: 'yarn' }],
]

describe('init project detection', () => {
  it.each(MATRIX)('%s', (name, expected) => {
    const detected = project(name)
    const { pm, ...rest } = expected
    expect(detected).toMatchObject(rest)
    if (pm !== undefined) {
      expect(detected.packageManager.name).toBe(pm)
    }
  })

  it('reports billing, editors and existing email providers', () => {
    const next = project('next-better-auth')
    expect(next.billing).toEqual(['stripe'])
    expect(next.editors).toEqual(['cursor'])
    expect(project('express-resend').existingEmail).toEqual([
      { provider: 'resend', source: 'dependency' },
    ])
    expect(project('react-email').existingEmail).toEqual([
      { provider: 'nodemailer', source: 'dependency' },
      { provider: 'react-email', source: 'dependency' },
      { provider: 'react-email', source: 'directory', path: 'emails' },
    ])
  })

  it('reads Yarn Plug-n-Play', () => {
    const berry = project('yarn-berry-pnp')
    expect(berry.packageManager).toMatchObject({
      name: 'yarn',
      yarnFlavor: 'berry',
      pnp: true,
    })
  })

  it('is ambiguous at a monorepo root with several apps, and lists them', () => {
    const result = detectProject(copyFixture('pnpm-turbo'), { env: {} })
    expect(result.kind).toBe('ambiguous')
    if (result.kind === 'ambiguous') {
      expect(
        result.candidates.map((candidate) => [
          candidate.dir,
          candidate.framework,
        ])
      ).toEqual([
        ['apps/api', 'hono'],
        ['apps/web', 'next'],
      ])
    }
  })

  it('picks one app of a monorepo with --app, as a workspace', () => {
    const root = copyFixture('pnpm-turbo')
    const result = detectProject(root, { app: 'apps/web', env: {} })
    expect(result.kind).toBe('project')
    if (result.kind === 'project') {
      expect(result.project.framework).toBe('next-app')
      expect(result.project.monorepo).toMatchObject({
        tool: 'turbo',
        workspace: 'apps/web',
        workspaceName: 'web',
      })
      expect(result.project.packageManager.name).toBe('pnpm')
    }
  })

  it('finds nothing to set up without a package.json or Supabase functions', () => {
    expect(
      detectProject(copyFixture('no-package-json'), { env: {} }).kind
    ).toBe('none')
  })

  it('takes the agent environment into account (Claude Code, a cloud shell)', () => {
    const result = detectProject(copyFixture('next-firebase'), {
      env: { CLAUDECODE: '1', REPL_ID: 'abc' },
    })
    expect(result.kind === 'project' && result.project.editors).toEqual([
      'claude-code',
    ])
    expect(result.kind === 'project' && result.project.remote).toBe('Replit')
  })
})
