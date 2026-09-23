import { CliUsageError } from './errors'

/**
 * 0.6 shims. Flags and command names are additive-only after release
 * (AGENTS.md), so a released flag keeps working where the API moved: an id
 * flag on a list (`runs list --run <id>`) performs the detail read and
 * answers the way 0.6 did, that one row as a single-row page, and
 * `--include`, which rides detail reads only today, is refused with the
 * command that takes it instead of being forwarded to a `400`.
 */

/** The 0.6 shape of a list narrowed to one id: that row, page complete. */
export function singleRowPage<T>(row: T): {
  readonly data: readonly [T]
  readonly pagination: { readonly cursor: null; readonly hasMore: false }
} {
  return { data: [row], pagination: { cursor: null, hasMore: false } }
}

/** `--include` used to ride list reads; detail reads carry it now. */
export function includeRidesDetailRead(
  getCommand: string,
  idFlag?: string
): CliUsageError {
  const pairing = idFlag === undefined ? '' : `, or pair it with ${idFlag}`
  return new CliUsageError(
    `--include rides the detail read: use \`brew-cli ${getCommand} <id> --include …\`${pairing}.`
  )
}
