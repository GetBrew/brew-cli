import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { brandMatchesApp, normalizeHost } from '../../../src/lib/init/brand'
import { readClerkSecret } from '../../../src/lib/init/providers/clerk'
import {
  detectSupabaseRef,
  generateHookSecret,
} from '../../../src/lib/init/providers/supabase'
import { tempProject } from '../../helpers/fixtures'

const REF = 'abcdefghijklmnopqrst'

describe('detectSupabaseRef', () => {
  it('prefers the flag, then supabase link, then a SUPABASE_URL, then Lovable files', () => {
    const root = tempProject()
    expect(detectSupabaseRef({ root, env: {}, flag: undefined })).toBeNull()
    writeFileSync(
      join(root, '.env'),
      `VITE_SUPABASE_URL=https://${REF}.supabase.co\n`
    )
    expect(detectSupabaseRef({ root, env: {}, flag: undefined })).toEqual({
      ref: REF,
      source: '.env VITE_SUPABASE_URL',
    })
    expect(
      detectSupabaseRef({
        root,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: 'https://zyxwvutsrqponmlkjihg.supabase.co',
        },
        flag: undefined,
      })?.ref
    ).toBe('zyxwvutsrqponmlkjihg')
    mkdirSync(join(root, 'supabase/.temp'), { recursive: true })
    writeFileSync(
      join(root, 'supabase/.temp/project-ref'),
      'qwertyuiopasdfghjklz\n'
    )
    expect(detectSupabaseRef({ root, env: {}, flag: undefined })?.ref).toBe(
      'qwertyuiopasdfghjklz'
    )
    expect(
      detectSupabaseRef({ root, env: {}, flag: 'mnbvcxzlkjhgfdsapoiu' })
    ).toEqual({
      ref: 'mnbvcxzlkjhgfdsapoiu',
      source: '--supabase-project',
    })
  })

  it("reads Lovable's client, and a config.toml project_id only when it is shaped like a ref", () => {
    const root = tempProject()
    mkdirSync(join(root, 'supabase'))
    writeFileSync(
      join(root, 'supabase/config.toml'),
      'project_id = "my-local-app"\n'
    )
    expect(detectSupabaseRef({ root, env: {}, flag: undefined })).toBeNull()
    writeFileSync(join(root, 'supabase/config.toml'), `project_id = "${REF}"\n`)
    expect(detectSupabaseRef({ root, env: {}, flag: undefined })?.source).toBe(
      'supabase/config.toml project_id'
    )
    mkdirSync(join(root, 'src/integrations/supabase'), { recursive: true })
    writeFileSync(
      join(root, 'src/integrations/supabase/client.ts'),
      'const SUPABASE_URL = "https://lkjhgfdsapoiuytrewqm.supabase.co";\n'
    )
    expect(detectSupabaseRef({ root, env: {}, flag: undefined })).toEqual({
      ref: 'lkjhgfdsapoiuytrewqm',
      source: 'src/integrations/supabase/client.ts',
    })
  })
})

describe('generateHookSecret', () => {
  it('is a fresh Standard Webhooks secret each time', () => {
    const first = generateHookSecret()
    expect(first).toMatch(/^v1,whsec_[A-Za-z0-9+/]{43}=$/)
    expect(generateHookSecret()).not.toBe(first)
  })
})

describe('readClerkSecret', () => {
  it('reads the shell first, then .env.local, then .env', () => {
    const root = tempProject()
    expect(readClerkSecret({ root, env: {} })).toBeUndefined()
    writeFileSync(join(root, '.env'), 'CLERK_SECRET_KEY=sk_test_fromenv\n')
    expect(readClerkSecret({ root, env: {} })).toBe('sk_test_fromenv')
    writeFileSync(
      join(root, '.env.local'),
      'CLERK_SECRET_KEY=sk_test_fromlocal\n'
    )
    expect(readClerkSecret({ root, env: {} })).toBe('sk_test_fromlocal')
    expect(
      readClerkSecret({ root, env: { CLERK_SECRET_KEY: 'sk_test_shell' } })
    ).toBe('sk_test_shell')
  })
})

describe('brand matching', () => {
  it('normalizes hosts and matches the brand website or its subdomains only', () => {
    expect(normalizeHost('https://www.Acme.com/pricing')).toBe('acme.com')
    expect(normalizeHost('acme.com')).toBe('acme.com')
    expect(normalizeHost('')).toBeNull()
    expect(brandMatchesApp('acme.com', 'https://acme.com')).toBe(true)
    expect(brandMatchesApp('acme.com', 'https://app.acme.com')).toBe(true)
    expect(brandMatchesApp('https://www.acme.com', 'https://acme.com/x')).toBe(
      true
    )
    expect(brandMatchesApp('acme.com', 'https://notacme.com')).toBe(false)
    expect(brandMatchesApp('app.acme.com', 'https://acme.com')).toBe(false)
    expect(brandMatchesApp(null, 'https://acme.com')).toBe(false)
  })
})
