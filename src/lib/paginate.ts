import { progress } from './output'
import type { CliContext } from './types'

export type Page<T> = {
  readonly data: ReadonlyArray<T>
  readonly pagination?: {
    readonly cursor: string | null
  }
}

/**
 * Drains a cursor-paginated list for `--all`. The API contract keeps
 * `pagination.cursor` string-or-null (never omitted); a repeated cursor
 * aborts the loop as a defense against a server-side pagination bug.
 */
export async function collectAll<T>(
  ctx: CliContext,
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>
): Promise<ReadonlyArray<T>> {
  const rows: T[] = []
  let cursor: string | undefined
  let pageCount = 0
  for (;;) {
    const page = await fetchPage(cursor)
    rows.push(...page.data)
    pageCount += 1
    const next = page.pagination?.cursor ?? null
    if (next === null || next === cursor) {
      return rows
    }
    cursor = next
    progress(ctx, `Fetched ${rows.length} rows (page ${pageCount})…`)
  }
}

/** The `--all` flag shared by paginated list commands. */
export const ALL_FLAG = {
  flag: '--all',
  summary: 'Follow the cursor and return every page as one result',
} as const

export const LIMIT_FLAG = {
  flag: '--limit <n>',
  summary: 'Page size, 1-100 (default 100)',
} as const

export const CURSOR_FLAG = {
  flag: '--cursor <cursor>',
  summary: 'Opaque pagination cursor from a previous page',
} as const
