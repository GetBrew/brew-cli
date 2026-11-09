import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import type { InitReport } from '../src/lib/init/report'
import { contractHandler } from './helpers/contract-artifacts'
import { copyFixture } from './helpers/fixtures'
import { server } from './helpers/msw-server'
import { runCli } from './helpers/run-cli'

/**
 * The files `init` generates must compile against the real `@brew.new/sdk`
 * types (the installed package), with the key registry from the generated
 * contracts in force, under a strict tsconfig. Each case runs init against
 * a fixture, copies the generated TypeScript into a scratch project that
 * links the SDK, and runs the repo's own `tsc`.
 */

const REPO = join(import.meta.dirname, '..')
const TSC = join(REPO, 'node_modules/typescript/bin/tsc')
const API = 'https://brew.new/api'
const APP_KEY = 'brew_typecheck0123456789abcdefghijkl'
const KEYS = [
  'auth.verify-email',
  'auth.password-reset',
  'auth.magic-link',
  'auth.otp',
  'auth.email-change',
  'lifecycle.welcome',
]

function triggerRows() {
  return KEYS.map((key, index) => ({
    triggerEventId: `tri_${index}`,
    key,
    title: key,
    provider: 'brew_api',
    payloadSchema: {
      type: 'object',
      fields: [
        { key: 'email', type: 'string', required: true },
        { key: 'appName', type: 'string', required: false },
        { key: 'userName', type: 'string', required: false },
        { key: 'confirmationUrl', type: 'string', required: false },
        { key: 'otp', type: 'string', required: false },
        { key: 'newEmail', type: 'string', required: false },
        { key: 'expiresInMinutes', type: 'int', required: false },
      ],
    },
    createdAt: '2026-10-13T12:00:00.000Z',
    updatedAt: '2026-10-13T12:00:00.000Z',
  }))
}

function useApi(): void {
  server.use(
    http.get(`${API}/v1/brand`, () =>
      HttpResponse.json({ brandId: 'bd_1', domain: 'acme.com' })
    ),
    http.get(`${API}/v1/domains`, () =>
      HttpResponse.json({
        data: [],
        pagination: { limit: 100, cursor: null, hasMore: false },
      })
    ),
    http.post(`${API}/v1/app-emails/kit`, () =>
      HttpResponse.json({
        results: [],
        stack: {
          provider: 'custom',
          authDelivery: 'code',
          note: '',
          keys: [],
          snippets: [],
        },
      })
    ),
    contractHandler(API, triggerRows),
    http.get(`${API}/v1/automations/triggers`, () =>
      HttpResponse.json({
        data: triggerRows(),
        pagination: { limit: 100, cursor: null, hasMore: false },
      })
    )
  )
}

function link(target: string, path: string): void {
  mkdirSync(dirname(path), { recursive: true })
  symlinkSync(realpathSync(target), path, 'dir')
}

/** A scratch TypeScript project holding the generated files. */
function scratchProject(input: {
  readonly root: string
  readonly files: readonly string[]
  readonly nodeNext: boolean
}): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'brew-init-tsc-')))
  const js = input.files.some((file) => /\.[cm]?js$/.test(file))
  for (const file of input.files) {
    mkdirSync(dirname(join(dir, file)), { recursive: true })
    cpSync(join(input.root, file), join(dir, file))
  }
  link(
    join(REPO, 'node_modules/@brew.new/sdk'),
    join(dir, 'node_modules/@brew.new/sdk')
  )
  link(
    join(REPO, 'node_modules/@types/node'),
    join(dir, 'node_modules/@types/node')
  )
  // `after` from next/server, as Next 15+ declares it.
  mkdirSync(join(dir, 'node_modules/next'), { recursive: true })
  writeFileSync(
    join(dir, 'node_modules/next/package.json'),
    '{"name":"next","version":"16.0.0"}\n'
  )
  writeFileSync(
    join(dir, 'node_modules/next/server.d.ts'),
    'export declare function after<T>(task: T | Promise<T> | (() => T | Promise<T>)): void\n'
  )
  // SvelteKit's private env module and Vite's import.meta.env, as the
  // frameworks declare them.
  writeFileSync(
    join(dir, 'framework-env.d.ts'),
    [
      "declare module '$env/dynamic/private' {",
      '  export const env: Record<string, string | undefined>',
      '}',
      'interface ImportMetaEnv {',
      '  readonly [key: string]: string | undefined',
      '}',
      'interface ImportMeta {',
      '  readonly env: ImportMetaEnv',
      '}',
      '',
    ].join('\n')
  )
  writeFileSync(
    join(dir, 'package.json'),
    `{"name":"scratch","private":true${input.nodeNext ? ',"type":"module"' : ''}}\n`
  )
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2022'],
          module: input.nodeNext ? 'NodeNext' : 'ESNext',
          moduleResolution: input.nodeNext ? 'NodeNext' : 'Bundler',
          strict: true,
          exactOptionalPropertyTypes: true,
          noUncheckedIndexedAccess: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          verbatimModuleSyntax: true,
          types: ['node'],
          noEmit: true,
          skipLibCheck: true,
          // Generated JavaScript (Astro's helpers) is skipped without
          // allowJs and checkJs. It carries no annotations, as plain JS
          // does not: everything else is still checked.
          ...(js ? { allowJs: true, checkJs: true, noImplicitAny: false } : {}),
        },
        include: [...input.files, 'framework-env.d.ts'],
      },
      null,
      2
    )
  )
  return dir
}

function typecheck(dir: string): string {
  try {
    execFileSync(process.execPath, [TSC, '-p', dir], {
      encoding: 'utf8',
      stdio: 'pipe',
    })
    return ''
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string }
    return `${failed.stdout ?? ''}${failed.stderr ?? ''}` || 'tsc failed'
  }
}

const CASES: ReadonlyArray<readonly [fixture: string, nodeNext: boolean]> = [
  ['next-better-auth', false],
  ['next-app-authjs-v5', false],
  ['next-pages-authjs-v4', false],
  ['react-router-clerk', false],
  ['hono-workers', false],
  ['express-resend', true],
  ['next-firebase', false],
  ['sveltekit', false],
  ['astro', false],
]

/** Runs init on a copy of `fixture`; the client, auth and contracts files. */
async function generate(fixture: string): Promise<{
  readonly root: string
  readonly generated: readonly string[]
}> {
  useApi()
  const root = copyFixture(fixture)
  writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
  const result = await runCli(
    [
      'init',
      '--yes',
      '--json',
      '--no-install',
      '--no-test-email',
      '--no-mcp',
      '--no-agent-files',
    ],
    {
      cwd: root,
      env: {
        BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-tsc-')),
      },
    }
  )
  const report = result.json as InitReport
  const generated = report.files
    .filter(
      (file) =>
        ['client', 'auth', 'contracts'].includes(file.role) &&
        file.action === 'created'
    )
    .map((file) => file.path)
  return { root, generated }
}

describe('generated files type-check against @brew.new/sdk', () => {
  it.each(CASES)(
    '%s',
    async (fixture, nodeNext) => {
      const { root, generated } = await generate(fixture)
      expect(generated.length).toBeGreaterThanOrEqual(2)
      const dir = scratchProject({ root, files: generated, nodeNext })
      expect(typecheck(dir)).toBe('')
    },
    60_000
  )

  it('checks generated JavaScript too (negative control)', async () => {
    const { root, generated } = await generate('astro')
    const helper = generated.find((path) => path.endsWith('.js'))
    expect(helper).toBeDefined()
    appendFileSync(
      join(root, helper ?? ''),
      "\nexport const typo = 'text'.notAMethod()\n"
    )
    const dir = scratchProject({ root, files: generated, nodeNext: false })
    expect(typecheck(dir)).toContain('notAMethod')
  }, 60_000)

  it('fails on an unknown key once the registry is generated (negative control)', async () => {
    useApi()
    const root = copyFixture('next-better-auth')
    writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
    await runCli(
      [
        'init',
        '--yes',
        '--json',
        '--no-install',
        '--no-test-email',
        '--no-mcp',
      ],
      {
        cwd: root,
        env: {
          BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-tsc-')),
        },
      }
    )
    writeFileSync(
      join(root, 'lib/typo.ts'),
      [
        "import { getBrew } from './brew'",
        '',
        'export async function typo(): Promise<void> {',
        "  await getBrew().send('lifecycle.welcom', { email: 'a@b.c' })",
        '}',
        '',
      ].join('\n')
    )
    const dir = scratchProject({
      root,
      files: ['lib/brew.ts', 'lib/brew-contracts.ts', 'lib/typo.ts'],
      nodeNext: false,
    })
    expect(typecheck(dir)).toContain('lifecycle.welcom')
  }, 60_000)
})
