import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectProject } from '../../../src/lib/init/detect'
import { authjsPatch, betterAuthPatch } from '../../../src/lib/init/patches'
import { copyFixture } from '../../helpers/fixtures'

/** A fixture with one file's text replaced. */
function edited(fixture: string, path: string, text: string): string {
  const root = copyFixture(fixture)
  writeFileSync(join(root, path), text)
  return root
}

const ADAPTER_CONFIG = (providers: string) =>
  [
    "import NextAuth from 'next-auth'",
    "import GitHub from 'next-auth/providers/github'",
    '',
    'export const { handlers, auth } = NextAuth({',
    '  adapter: PrismaAdapter(prisma),',
    `  providers: ${providers},`,
    '})',
    '',
  ].join('\n')

function detect(root: string) {
  const result = detectProject(root, { env: {} })
  if (result.kind !== 'project') {
    throw new Error(`expected a project, got ${result.kind}`)
  }
  return result.project
}

describe('authjsPatch', () => {
  it('stays manual without a database adapter (Auth.js would refuse to start)', () => {
    const root = copyFixture('next-app-authjs-v5')
    const { patch, next } = authjsPatch(detect(root), 'src/lib/brew-auth.ts')
    expect(patch.status).toBe('manual')
    expect(patch.description).toContain('no database adapter')
    expect(next).toBeUndefined()
  })

  it('adds the provider when the config has an adapter', () => {
    const root = copyFixture('next-app-authjs-v5')
    const path = join(root, 'src/auth.ts')
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(
        '  providers: [GitHub],',
        '  adapter: PrismaAdapter(prisma),\n  providers: [GitHub],'
      )
    )
    const { patch, next } = authjsPatch(detect(root), 'src/lib/brew-auth.ts')
    expect(patch.status).toBe('pending')
    expect(next).toContain('providers: [brewEmailProvider, GitHub],')
  })
})

describe('patch diffs never print a secret', () => {
  it('never prints a secret on the edited line, and no context lines', () => {
    const root = edited(
      'next-app-authjs-v5',
      'src/auth.ts',
      ADAPTER_CONFIG("[GitHub({ clientSecret: 'gh-secret-123' })]")
    )
    const { patch, next } = authjsPatch(detect(root), 'src/lib/brew-auth.ts')
    expect(next).toContain("clientSecret: 'gh-secret-123'")
    expect(patch.diff).not.toContain('gh-secret-123')
    expect(patch.diff).not.toContain('PrismaAdapter')
    expect(patch.diff).toContain(
      "+  providers: [brewEmailProvider, GitHub({ clientSecret: '…' })],"
    )
  })

  const config = (body: readonly string[]) =>
    [
      "import { betterAuth } from 'better-auth'",
      '',
      'export const auth = betterAuth({',
      ...body,
      '})',
      '',
    ].join('\n')

  it('never prints a secret from the lines around the edit', () => {
    const root = edited(
      'next-better-auth',
      'lib/auth.ts',
      config([
        "  secret: 'ba-secret-456',",
        "  database: new Pool({ connectionString: 'postgres://u:p@db/app' }),",
      ])
    )
    const { patch } = betterAuthPatch(detect(root), 'lib/brew-auth.ts', {
      lifecycle: true,
    })
    expect(patch.status).toBe('pending')
    expect(patch.diff).not.toContain('ba-secret-456')
    expect(patch.diff).not.toContain('postgres://')
  })
})
