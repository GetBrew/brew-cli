import { readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getOrCreateHostedHookSecret,
  hostedHookSecretPath,
} from '../../../src/lib/init/providers/hosted-hook-secret'
import { ProjectWriter } from '../../../src/lib/project/fs-writer'
import { tempProject } from '../../helpers/fixtures'

const REF = 'abcdefghijklmnopqrst'

describe('durable hosted-hook setup secret', () => {
  it('shares one secret between overlapping setups and preserves it for a retry', async () => {
    const root = tempProject()
    const firstWriter = new ProjectWriter({ root })
    const secondWriter = new ProjectWriter({ root })
    const [first, second] = await Promise.all([
      getOrCreateHostedHookSecret(firstWriter, REF),
      getOrCreateHostedHookSecret(secondWriter, REF),
    ])
    expect(first).toMatch(/^v1,whsec_[A-Za-z0-9+/]{43}=$/)
    expect(second).toBe(first)
    expect(
      await getOrCreateHostedHookSecret(new ProjectWriter({ root }), REF)
    ).toBe(first)
    const file = join(root, hostedHookSecretPath(REF))
    expect(readFileSync(file, 'utf8')).toBe(first)
    expect(statSync(file).mode & 0o777).toBe(0o600)
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toContain(
      hostedHookSecretPath(REF)
    )
  })

  it('refuses a secret path that is a symbolic link', async () => {
    const root = tempProject()
    const outside = join(tempProject(), 'secret')
    writeFileSync(outside, 'unchanged')
    symlinkSync(outside, join(root, hostedHookSecretPath(REF)))
    await expect(
      getOrCreateHostedHookSecret(new ProjectWriter({ root }), REF)
    ).rejects.toThrow()
    expect(readFileSync(outside, 'utf8')).toBe('unchanged')
  })

  it('does not create credentials when the ignore rule cannot protect them', async () => {
    const root = tempProject()
    writeFileSync(
      join(root, '.gitignore'),
      `# brew:start\n# brew:end\n!${hostedHookSecretPath(REF)}\n`
    )
    await expect(
      getOrCreateHostedHookSecret(new ProjectWriter({ root }), REF)
    ).rejects.toThrow('ignored')
    expect(() => readFileSync(join(root, hostedHookSecretPath(REF)))).toThrow()
  })
})
