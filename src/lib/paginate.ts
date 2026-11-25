import { CliPaginationError } from './errors'
import { progress } from './output'
import type { CliContext } from './types'

export type Page<T> = {
  readonly data: ReadonlyArray<T>
  readonly pagination?: {
    readonly cursor: string | null
  }
}

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

export const ALL_FLAG = {
  flag: '--all',
  summary: 'Follow the cursor and return every page as one result',
} as const

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
