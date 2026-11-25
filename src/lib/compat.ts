import { CliUsageError } from './errors'

export function singleRowPage<T>(row: T): {
  readonly data: readonly [T]
  readonly pagination: { readonly cursor: null; readonly hasMore: false }
} {
  return { data: [row], pagination: { cursor: null, hasMore: false } }
}

export function inputField(base: unknown, key: string): string | undefined {
  if (base === null || typeof base !== 'object') {
    return undefined
  }
  const value = (base as Record<string, unknown>)[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

export function includeRidesDetailRead(
  getCommand: string,
  idFlag?: string
): CliUsageError {
  const pairing = idFlag === undefined ? '' : `, or pair it with ${idFlag}`
  return new CliUsageError(
    `--include rides the detail read: use \`brew-cli ${getCommand} <id> --include …\`${pairing}.`
  )
}
