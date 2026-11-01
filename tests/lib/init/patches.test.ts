import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectProject } from '../../../src/lib/init/detect'
import {
  authjsPatch,
  betterAuthPatch,
  supabaseConfigPatch,
} from '../../../src/lib/init/patches'
import { copyFixture } from '../../helpers/fixtures'

const BOTH = { auth: true, lifecycle: true }

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

  it('stays manual when the only adapter is commented out', () => {
    const root = copyFixture('next-app-authjs-v5')
    const path = join(root, 'src/auth.ts')
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(
        '  providers: [GitHub],',
        '  // adapter: PrismaAdapter(prisma),\n  /* adapter: DrizzleAdapter(db), */\n  providers: [GitHub],'
      )
    )
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

describe('authjsPatch: the providers line', () => {
  it('keeps the comma when only a provider option is an empty list', () => {
    const root = edited(
      'next-app-authjs-v5',
      'src/auth.ts',
      ADAPTER_CONFIG('[GitHub({ checks: [] })]')
    )
    const { next } = authjsPatch(detect(root), 'src/lib/brew-auth.ts')
    expect(next).toContain(
      'providers: [brewEmailProvider, GitHub({ checks: [] })],'
    )
  })

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

  it('on Workers, leaves the per-request provider to the user', () => {
    const root = edited(
      'next-app-authjs-v5',
      'src/auth.ts',
      ADAPTER_CONFIG('[GitHub]')
    )
    const { patch } = authjsPatch(
      { ...detect(root), runtime: 'workers' },
      'src/lib/brew-auth.ts'
    )
    expect(patch.status).toBe('manual')
    expect(patch.snippet).toContain('createBrewEmailProvider(env)')
  })

  it('an import or a comment naming the provider is not a wired provider', () => {
    const imported = edited(
      'next-app-authjs-v5',
      'src/auth.ts',
      `import { brewEmailProvider } from './lib/brew-auth'\n${ADAPTER_CONFIG('[GitHub]')}`
    )
    const onlyImport = authjsPatch(detect(imported), 'src/lib/brew-auth.ts')
    expect(onlyImport.patch.status).toBe('manual')
    expect(onlyImport.patch.description).toContain('add it to providers')
    const commented = edited(
      'next-app-authjs-v5',
      'src/auth.ts',
      ADAPTER_CONFIG('[GitHub /* , brewEmailProvider */]')
    )
    const { patch, next } = authjsPatch(
      detect(commented),
      'src/lib/brew-auth.ts'
    )
    expect(patch.status).toBe('pending')
    expect(next).toContain('providers: [brewEmailProvider, GitHub')
  })
})

describe('betterAuthPatch', () => {
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
    const { patch } = betterAuthPatch(detect(root), 'lib/brew-auth.ts', BOTH)
    expect(patch.status).toBe('pending')
    expect(patch.diff).not.toContain('ba-secret-456')
    expect(patch.diff).not.toContain('postgres://')
  })

  it('wires only the welcome email without the auth set', () => {
    const root = copyFixture('next-better-auth')
    const { patch, next } = betterAuthPatch(detect(root), 'lib/brew-auth.ts', {
      auth: false,
      lifecycle: true,
    })
    expect(patch.status).toBe('pending')
    expect(next).toContain('brewEmails.onUserCreated')
    expect(next).not.toContain('sendVerificationEmail')
    expect(next).not.toContain('sendResetPassword')
  })

  it('leaves an emailAndPassword it cannot edit to the user', () => {
    const root = edited(
      'next-better-auth',
      'lib/auth.ts',
      config(['  emailAndPassword: { enabled: true },'])
    )
    const { patch } = betterAuthPatch(detect(root), 'lib/brew-auth.ts', BOTH)
    expect(patch.status).toBe('manual')
    expect(patch.description).toContain('sendResetPassword')
  })

  it('a re-run with the lifecycle set asks for the welcome hook it lacks', () => {
    const root = edited(
      'next-better-auth',
      'lib/auth.ts',
      [
        "import { brewEmails } from './brew-auth'",
        config([
          '  emailVerification: { sendVerificationEmail: brewEmails.sendVerificationEmail },',
        ]),
      ].join('\n')
    )
    const authOnly = { auth: true, lifecycle: false }
    expect(
      betterAuthPatch(detect(root), 'lib/brew-auth.ts', authOnly).patch.status
    ).toBe('already-applied')
    const { patch } = betterAuthPatch(detect(root), 'lib/brew-auth.ts', BOTH)
    expect(patch.status).toBe('manual')
    expect(patch.description).toContain('onUserCreated')
  })

  it('a commented-out callback is not wired', () => {
    const root = edited(
      'next-better-auth',
      'lib/auth.ts',
      [
        "import { brewEmails } from './brew-auth'",
        config([
          '  // emailVerification: { sendVerificationEmail: brewEmails.sendVerificationEmail },',
        ]),
      ].join('\n')
    )
    const authOnly = { auth: true, lifecycle: false }
    const { patch } = betterAuthPatch(
      detect(root),
      'lib/brew-auth.ts',
      authOnly
    )
    expect(patch.status).toBe('manual')
    expect(patch.description).toContain('sendVerificationEmail')
  })

  it('on Workers, leaves the per-request callbacks to the user', () => {
    const root = copyFixture('next-better-auth')
    const { patch } = betterAuthPatch(
      { ...detect(root), runtime: 'workers' },
      'lib/brew-auth.ts',
      BOTH
    )
    expect(patch.status).toBe('manual')
    expect(patch.snippet).toContain('createBrewEmails(env)')
  })
})

describe('supabaseConfigPatch', () => {
  const HOOK = [
    '[auth.hook.send_email]',
    'enabled = true',
    'uri = "http://host.docker.internal:54321/functions/v1/send-email"',
  ]

  it.each([
    ['commented out', HOOK.map((line) => `# ${line}`)],
    ['turned off', HOOK.map((line) => line.replace('true', 'false'))],
  ])('a hook %s is not applied', (_, lines) => {
    const root = edited(
      'supabase-functions',
      'supabase/config.toml',
      `project_id = "fnonly"\n\n${lines.join('\n')}\n`
    )
    const { patch } = supabaseConfigPatch(detect(root))
    expect(patch.status).not.toBe('already-applied')
  })

  it('never adds a second [functions.send-email] table', () => {
    const root = edited(
      'supabase-functions',
      'supabase/config.toml',
      'project_id = "fnonly"\n\n[functions.send-email]\nverify_jwt = false\n'
    )
    const { patch, next } = supabaseConfigPatch(detect(root))
    expect(patch.status).toBe('manual')
    expect(next).toBeUndefined()
  })
})
