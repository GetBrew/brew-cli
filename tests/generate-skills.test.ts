import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkSkillsModule,
  collectSkills,
  readFrontmatter,
  renderSkillsModule,
  SKILLS_MODULE_PATH,
} from '../scripts/generate-skills'
import { EMBEDDED_SKILLS } from '../src/generated/skills'

const REPO = join(import.meta.dirname, '..')

describe('generate-skills', () => {
  it('the committed module is fresh (generate:skills --check)', () => {
    expect(checkSkillsModule(REPO)).toBeNull()
  })

  it('embeds every skills/**/SKILL.md verbatim', () => {
    const skills = collectSkills(REPO)
    expect(skills.map((skill) => skill.path)).toContain(
      'skills/brew-cli/SKILL.md'
    )
    expect(EMBEDDED_SKILLS).toEqual(skills)
    const cli = EMBEDDED_SKILLS.find((skill) => skill.name === 'brew-cli')
    expect(cli?.content).toContain('brew-cli mcp install')
    // No hard-coded command count to go stale.
    expect(cli?.content).not.toMatch(/\d+ commands/)
  })

  it('reports a stale module, and passes once regenerated', () => {
    const root = mkdtempSync(join(tmpdir(), 'brew-cli-skills-'))
    cpSync(join(REPO, 'skills'), join(root, 'skills'), { recursive: true })
    mkdirSync(join(root, 'src/generated'), { recursive: true })
    expect(checkSkillsModule(root)).toMatch(/is stale/)
    writeFileSync(
      join(root, SKILLS_MODULE_PATH),
      renderSkillsModule(collectSkills(root))
    )
    expect(checkSkillsModule(root)).toBeNull()
    mkdirSync(join(root, 'skills/brew-extra'))
    writeFileSync(
      join(root, 'skills/brew-extra/SKILL.md'),
      '---\nname: brew-extra\ndescription: "Extra"\n---\n\nBody\n'
    )
    expect(checkSkillsModule(root)).toMatch(/bun run generate:skills/)
  })

  it('reads frontmatter fields', () => {
    expect(
      readFrontmatter('---\nname: a\ndescription: "b c"\n---\nbody')
    ).toEqual({ name: 'a', description: 'b c' })
    expect(readFrontmatter('no frontmatter')).toEqual({})
  })
})
