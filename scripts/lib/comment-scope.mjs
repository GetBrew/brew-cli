import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function loadCommentScope(root) {
  const policy = JSON.parse(
    readFileSync(join(root, 'scripts/comment-ownership.json'), 'utf8')
  )
  const lockFile = join(root, 'skills-lock.json')
  const skills = existsSync(lockFile)
    ? JSON.parse(readFileSync(lockFile, 'utf8')).skills
    : {}
  const matches = (file, entries) =>
    entries.some((entry) =>
      entry.endsWith('/') ? file.startsWith(entry) : file === entry
    )
  return {
    policy,
    excludes(file) {
      const skill = file.match(/^\.agents\/skills\/([^/]+)\//)?.[1]
      return (
        (skill &&
          skills[skill]?.sourceType &&
          skills[skill].sourceType !== 'local') ||
        matches(file, policy.fixtures) ||
        matches(file, policy.generated) ||
        matches(file, policy.upstream ?? []) ||
        matches(file, policy.upstream ?? [])
      )
    },
    isManagedMarker(file, value) {
      const body = value.replace(/^<!--\s*|\s*-->$/g, '').trim()
      return (policy.markers[file] ?? []).includes(body)
    },
  }
}
