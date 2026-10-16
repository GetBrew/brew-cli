import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectProject } from '../../../src/lib/init/detect'
import { authjsPatch } from '../../../src/lib/init/patches'
import { copyFixture } from '../../helpers/fixtures'

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
