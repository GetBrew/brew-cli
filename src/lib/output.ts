import type { CliContext, OutputMode } from './types'

export function resolveOutputMode(input: {
  readonly isJsonFlag: boolean
  readonly isTtyOut: boolean
}): OutputMode {
  if (input.isJsonFlag) {
    return 'json'
  }
  return input.isTtyOut ? 'human' : 'json'
}

/**
 * Command data goes to stdout and nowhere else. JSON mode prints the API
 * payload verbatim (compact, one line) so pipes and agents get the exact
 * SDK envelope; human mode prefers the command's rendering when provided.
 */
export function printData(
  ctx: CliContext,
  data: unknown,
  human?: string
): void {
  if (ctx.mode === 'json') {
    ctx.io.stdout.write(`${JSON.stringify(data)}\n`)
    return
  }
  const text = human ?? JSON.stringify(data, null, 2)
  ctx.io.stdout.write(`${text}\n`)
}

/** Progress and status lines go to stderr and honor --quiet. */
export function progress(ctx: CliContext, message: string): void {
  if (ctx.globals.quiet) {
    return
  }
  ctx.io.stderr.write(`${message}\n`)
}

export function renderTable(
  rows: ReadonlyArray<Record<string, unknown>>,
  columns: ReadonlyArray<{ readonly key: string; readonly header: string }>
): string {
  const widths = columns.map((column) =>
    Math.max(
      column.header.length,
      ...rows.map((row) => formatCell(row[column.key]).length)
    )
  )
  const line = (cells: readonly string[]) =>
    cells
      .map((cell, index) => cell.padEnd(widths[index] ?? 0))
      .join('  ')
      .trimEnd()
  const header = line(columns.map((column) => column.header))
  const body = rows.map((row) =>
    line(columns.map((column) => formatCell(row[column.key])))
  )
  return [header, ...body].join('\n')
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}
