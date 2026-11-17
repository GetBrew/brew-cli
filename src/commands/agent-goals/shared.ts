import type { CommandInvocation } from '../../lib/define-command'
import { flagInt, flagString } from '../../lib/input'
import { collectAll } from '../../lib/paginate'
import { rawRequest } from '../../lib/raw-request'

export const GOAL_ID_ARG = {
  name: 'goalId',
  summary: 'Marketing goal id',
  isRequired: true,
} as const
export function goalPath(goalId: string): string {
  return `/v1/agent-goals/${encodeURIComponent(goalId)}`
}

export async function readGoalPage<T>(
  { ctx, flags }: CommandInvocation,
  path: string
) {
  const limit = flagInt(flags.limit, '--limit')
  const cursor = flagString(flags.cursor)
  const page = (after: string | undefined) =>
    rawRequest<{
      data: T[]
      pagination: { cursor: string | null; hasMore: boolean; limit: number }
    }>(ctx, {
      method: 'GET',
      path,
      query: {
        limit: limit === undefined ? undefined : String(limit),
        cursor: after,
      },
    })
  if (flags.all === true) {
    const rows = await collectAll(ctx, page, { cursor })
    return {
      data: { data: rows, pagination: { cursor: null, hasMore: false } },
    }
  }
  return { data: await page(cursor) }
}
