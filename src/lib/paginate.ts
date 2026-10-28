import { CliPaginationError } from './errors'
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
 * Pass the request's starting cursor in `options` so resumed walks also
 * refuse to fetch their first page again.
 *
 * An interrupt or `--timeout` stops the drain between pages as well as
 * mid-page. Rows fetched so far are NOT printed — a partial list would read
 * as the whole list — but the error reports how far it got and the cursor
 * to resume at.
 */
export async function collectAll<T>(
  ctx: CliContext,
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>,
  options?: { readonly cursor?: string | undefined }
): Promise<ReadonlyArray<T>> {
  const rows: T[] = []
  let cursor = options?.cursor
  let pageCount = 0
  const fetched = new Set<string>()
  for (;;) {
    let page: Page<T>
    try {
      ctx.signal.throwIfAborted()
      page = await fetchPage(cursor)
    } catch (error) {
      if (pageCount > 0) {
        ctx.transport.setDrain({
          rowsFetched: rows.length,
          pagesFetched: pageCount,
          ...(cursor === undefined ? {} : { resumeCursor: cursor }),
        })
      }
      throw error
    }
    rows.push(...page.data)
    pageCount += 1
    const next = page.pagination?.cursor ?? null
    assertPaginationProgress({
      ctx,
      fetchedCursors: fetched,
      cursor,
      next,
      rowsFetched: rows.length,
      pagesFetched: pageCount,
    })
    if (next === null) {
      return rows
    }
    cursor = next
    progress(ctx, `Fetched ${rows.length} rows (page ${pageCount})…`)
  }
}

/** Lists and nested message walks share the same cycle and error protocol. */
export function assertPaginationProgress({
  ctx,
  fetchedCursors,
  cursor,
  next,
  rowsFetched,
  pagesFetched,
}: {
  readonly ctx: CliContext
  readonly fetchedCursors: Set<string>
  readonly cursor: string | undefined
  readonly next: string | null
  readonly rowsFetched: number
  readonly pagesFetched: number
}): void {
  if (cursor !== undefined) {
    fetchedCursors.add(cursor)
  }
  if (next !== null && fetchedCursors.has(next)) {
    ctx.transport.setDrain({ rowsFetched, pagesFetched })
    throw new CliPaginationError(next)
  }
}

/** The `--all` flag shared by paginated list commands. */
export const ALL_FLAG = {
  flag: '--all',
  summary: 'Follow the cursor and return every page as one result',
} as const

/** Describes the server default without supplying a default request value. */
export function limitFlag(defaultSize: number) {
  return {
    flag: '--limit <n>',
    summary: `Page size, 1-100 (default ${defaultSize})`,
  } as const
}

export const LIMIT_FLAG = limitFlag(100)

export const CURSOR_FLAG = {
  flag: '--cursor <cursor>',
  summary: 'Opaque pagination cursor from a previous page',
} as const
