import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectProject } from '../../../src/lib/init/detect'
import {
  authHelperFile,
  authHelperPath,
  clientPath,
} from '../../../src/lib/init/templates'
import { copyFixture, tempProject } from '../../helpers/fixtures'

function detect(root: string) {
  const result = detectProject(root, { env: {} })
  if (result.kind !== 'project') {
    throw new Error(`expected a project, got ${result.kind}`)
  }
  return result.project
}

const BOTH = { auth: true, lifecycle: true }

describe('generated helpers', () => {
  it('a CommonJS JavaScript server gets ES modules Node can load (.mjs)', () => {
    const root = tempProject()
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ dependencies: { express: '4.21.0' } })
    )
    const project = detect(root)
    expect(clientPath(project)).toBe('lib/brew.mjs')
    expect(authHelperPath(project)).toBe('lib/brew-auth.mjs')
    expect(authHelperFile(project, BOTH)).toContain(
      "import { getBrew } from './brew.mjs'"
    )
  })

  it.each([
    ['better-auth', 'createBrewEmails'],
    ['authjs', 'createBrewEmailProvider'],
  ] as const)(
    'a Worker builds the %s adapter from the request env',
    (auth, factory) => {
      const project = { ...detect(copyFixture('hono-workers')), auth }
      const file = authHelperFile(project, BOTH)
      expect(file).toContain(
        `export function ${factory}(env: { BREW_API_KEY?: string }) {`
      )
      expect(file).toContain('client: () => getBrew(env)')
      expect(file).not.toContain('client: getBrew')
    }
  )

  it('Auth.js without the auth set offers no sign-in provider', () => {
    const project = detect(copyFixture('next-app-authjs-v5'))
    const file = authHelperFile(project, { auth: false, lifecycle: true })
    expect(file).not.toContain('BrewEmail')
    expect(file).toContain('export async function sendWelcomeEmail(')
  })
})
