import { CliUsageError } from './errors'
import type { CommandTraits } from './types'

/**
 * Refuses `--input` keys the command would not send. The SDK builds each
 * request from the fields it knows, so an unknown key (a typo, or a field
 * of another operation) would be dropped and the command would still exit 0.
 * Only a top-level JSON object is checked: arrays and nested values pass.
 */
export function assertKnownInputKeys(
  traits: CommandTraits | undefined,
  input: unknown
): void {
  const allowed = traits?.inputKeys
  if (
    allowed === undefined ||
    input === null ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    return
  }
  const unknown = Object.keys(input).filter((key) => !allowed.has(key))
  if (unknown.length === 0) {
    return
  }
  const named = unknown
    .map((key) => {
      const suggestion = closestKey(key, allowed)
      return suggestion === undefined
        ? `\`${key}\``
        : `\`${key}\` (did you mean \`${suggestion}\`?)`
    })
    .join(', ')
  throw new CliUsageError(
    `Unknown --input ${unknown.length === 1 ? 'key' : 'keys'} ${named}: it would not be sent. Accepted: ${[...allowed].sort().join(', ')}.`
  )
}

/** A case-insensitive match, else the nearest key within two edits. */
function closestKey(
  key: string,
  allowed: ReadonlySet<string>
): string | undefined {
  const lower = key.toLowerCase()
  let best: string | undefined
  let bestDistance = 3
  for (const candidate of allowed) {
    if (candidate.toLowerCase() === lower) {
      return candidate
    }
    const distance = editDistance(lower, candidate.toLowerCase())
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    previous = current
  }
  return previous[b.length] ?? 0
}
