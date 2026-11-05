/**
 * A tiny unified line diff for dry-run previews of the small files project
 * commands write (configs, env files, managed blocks). LCS over lines; a
 * pair of inputs too large for the quadratic table degrades to one hunk
 * that replaces everything, which is still a correct diff.
 */

type Op = { readonly kind: ' ' | '-' | '+'; readonly line: string }

const MAX_CELLS = 4_000_000

export function splitLines(text: string): string[] {
  if (text === '') {
    return []
  }
  const lines = text.replaceAll('\r\n', '\n').split('\n')
  if (lines.at(-1) === '') {
    lines.pop()
  }
  return lines
}

function diffOps(before: readonly string[], after: readonly string[]): Op[] {
  const n = before.length
  const m = after.length
  if (n * m > MAX_CELLS) {
    return [
      ...before.map((line) => ({ kind: '-' as const, line })),
      ...after.map((line) => ({ kind: '+' as const, line })),
    ]
  }
  // lcs[i][j] = LCS length of before[i..] and after[j..], flattened.
  const width = m + 1
  const lcs = new Uint32Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i * width + j] =
        before[i] === after[j]
          ? (lcs[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(lcs[(i + 1) * width + j] ?? 0, lcs[i * width + j + 1] ?? 0)
    }
  }
  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    const a = before[i] ?? ''
    const b = after[j] ?? ''
    if (a === b) {
      ops.push({ kind: ' ', line: a })
      i += 1
      j += 1
    } else if (
      (lcs[(i + 1) * width + j] ?? 0) >= (lcs[i * width + j + 1] ?? 0)
    ) {
      ops.push({ kind: '-', line: a })
      i += 1
    } else {
      ops.push({ kind: '+', line: b })
      j += 1
    }
  }
  for (; i < n; i += 1) {
    ops.push({ kind: '-', line: before[i] ?? '' })
  }
  for (; j < m; j += 1) {
    ops.push({ kind: '+', line: after[j] ?? '' })
  }
  return ops
}

/**
 * `before` → `after` as a unified diff with `context` lines around each
 * change, or `''` when the texts are equal (line endings ignored). A file
 * that does not exist yet is `before: ''`.
 */
export function unifiedDiff(
  before: string,
  after: string,
  options: {
    readonly fromPath?: string
    readonly toPath?: string
    readonly context?: number
  } = {}
): string {
  const ops = diffOps(splitLines(before), splitLines(after))
  if (ops.every((op) => op.kind === ' ')) {
    return ''
  }
  const context = options.context ?? 3
  const out: string[] = [
    `--- ${options.fromPath ?? 'a'}`,
    `+++ ${options.toPath ?? options.fromPath ?? 'b'}`,
  ]
  // Positions (1-based) of each op in the old and new files.
  const oldAt: number[] = []
  const newAt: number[] = []
  let oldLine = 1
  let newLine = 1
  for (const op of ops) {
    oldAt.push(oldLine)
    newAt.push(newLine)
    if (op.kind !== '+') {
      oldLine += 1
    }
    if (op.kind !== '-') {
      newLine += 1
    }
  }
  let index = 0
  while (index < ops.length) {
    if (ops[index]?.kind === ' ') {
      index += 1
      continue
    }
    const start = Math.max(0, index - context)
    let end = index
    // Extend the hunk while the next change is within 2 * context lines.
    for (;;) {
      while (end < ops.length && ops[end]?.kind !== ' ') {
        end += 1
      }
      let next = end
      while (next < ops.length && ops[next]?.kind === ' ') {
        next += 1
      }
      if (next < ops.length && next - end <= context * 2) {
        end = next
        continue
      }
      end = Math.min(ops.length, end + context)
      break
    }
    const hunk = ops.slice(start, end)
    const oldCount = hunk.filter((op) => op.kind !== '+').length
    const newCount = hunk.filter((op) => op.kind !== '-').length
    const oldStart = oldCount === 0 ? (oldAt[start] ?? 1) - 1 : oldAt[start]
    const newStart = newCount === 0 ? (newAt[start] ?? 1) - 1 : newAt[start]
    out.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`)
    for (const op of hunk) {
      out.push(`${op.kind}${op.line}`)
    }
    index = end
  }
  return `${out.join('\n')}\n`
}
