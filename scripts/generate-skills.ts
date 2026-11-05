import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Embeds every `skills/<name>/SKILL.md` into `src/generated/skills.ts`, so
 * the bundled CLI can install its agent skills into a project (`init`)
 * without reading files that the npm package or a compiled binary may not
 * carry.
 *   bun run generate:skills          — write the module
 *   bun run generate:skills:check    — fail when it is stale
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const SKILLS_MODULE_PATH = 'src/generated/skills.ts'

export type SkillSource = {
  readonly name: string
  readonly description: string
  /** Repo-relative, POSIX. */
  readonly path: string
  readonly content: string
}

function findSkillFiles(dir: string): string[] {
  const found: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir).sort()
  } catch {
    return found
  }
  for (const entry of entries) {
    const path = join(dir, entry)
    if (entry === 'SKILL.md') {
      found.push(path)
      continue
    }
    found.push(...findSkillFiles(path))
  }
  return found
}

/** `name` and `description` from a SKILL.md's YAML frontmatter. */
export function readFrontmatter(content: string): {
  readonly name?: string
  readonly description?: string
} {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(content)
  if (match === null) {
    return {}
  }
  const fields: Record<string, string> = {}
  for (const line of (match[1] ?? '').split('\n')) {
    const field = /^([a-zA-Z_-]+):\s*(.*)$/.exec(line)
    if (field?.[1] !== undefined && field[2] !== undefined) {
      fields[field[1]] = field[2].trim().replace(/^(['"])(.*)\1$/, '$2')
    }
  }
  return {
    ...(fields.name === undefined ? {} : { name: fields.name }),
    ...(fields.description === undefined
      ? {}
      : { description: fields.description }),
  }
}

export function collectSkills(root: string = REPO_ROOT): SkillSource[] {
  return findSkillFiles(join(root, 'skills'))
    .map((file) => {
      const content = readFileSync(file, 'utf8').replaceAll('\r\n', '\n')
      const path = relative(root, file).split(sep).join('/')
      const frontmatter = readFrontmatter(content)
      const name = frontmatter.name ?? path.split('/').at(-2) ?? path
      if (frontmatter.description === undefined) {
        throw new Error(`${path} has no frontmatter description.`)
      }
      return { name, description: frontmatter.description, path, content }
    })
    .sort((a, b) => a.path.localeCompare(b.path))
}

export function renderSkillsModule(skills: readonly SkillSource[]): string {
  const lines = [
    '// GENERATED FILE — do not edit. Regenerate with `bun run generate:skills`.',
    '// Source: skills/**/SKILL.md',
    '',
    'export type EmbeddedSkill = {',
    '  readonly name: string',
    '  readonly description: string',
    '  /** Path in the brew-cli repo, e.g. `skills/brew-cli/SKILL.md`. */',
    '  readonly path: string',
    '  readonly content: string',
    '}',
    '',
    'export const EMBEDDED_SKILLS: readonly EmbeddedSkill[] = [',
  ]
  for (const skill of skills) {
    lines.push(
      '  {',
      `    name: ${JSON.stringify(skill.name)},`,
      `    description: ${JSON.stringify(skill.description)},`,
      `    path: ${JSON.stringify(skill.path)},`,
      `    content: ${JSON.stringify(skill.content)},`,
      '  },'
    )
  }
  lines.push(']', '')
  return lines.join('\n')
}

/** `null` when the committed module matches the skills; else the fix. */
export function checkSkillsModule(root: string = REPO_ROOT): string | null {
  const next = renderSkillsModule(collectSkills(root))
  let current = ''
  try {
    current = readFileSync(join(root, SKILLS_MODULE_PATH), 'utf8')
  } catch {
    current = ''
  }
  return current === next
    ? null
    : `${SKILLS_MODULE_PATH} is stale. Run \`bun run generate:skills\` and commit.`
}

function main(): void {
  if (process.argv.includes('--check')) {
    const problem = checkSkillsModule()
    if (problem !== null) {
      console.error(problem)
      process.exit(1)
    }
    console.log(`${SKILLS_MODULE_PATH} is fresh.`)
    return
  }
  const output = join(REPO_ROOT, SKILLS_MODULE_PATH)
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, renderSkillsModule(collectSkills()))
  console.log(`Wrote ${output}`)
}

const entry = process.argv[1]
if (entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url)) {
  main()
}
