/**
 * Dotenv files (`.env.local`, `.env.example`) edited without losing what the
 * user wrote: comments, blank lines, order, quoting and line endings all
 * round-trip byte for byte, and a variable is only ever ADDED (or filled
 * when present but empty), never replaced.
 *
 * Values are secrets. Nothing here returns or prints one: results name the
 * variable and what happened to it, never its value. Write the result with
 * `ProjectWriter.writeFile(path, text, { overwrite: true, mode: 0o600,
 * sensitive: true })` so no dry-run diff carries it either.
 */

export type EnvLine =
  | {
      readonly kind: 'var'
      readonly key: string
      readonly value: string
      /** The source line(s) exactly as read (a quoted value can span lines). */
      readonly raw: string
    }
  | { readonly kind: 'other'; readonly raw: string }

export type EnvFile = {
  readonly lines: readonly EnvLine[]
  readonly eol: '\n' | '\r\n'
  readonly trailingNewline: boolean
}

export type EnsureVarAction =
  /** The variable was absent and was appended. */
  | 'added'
  /** The variable was present with an empty value, now set. */
  | 'filled'
  /** The variable already had a value: left exactly as it was. */
  | 'kept-existing'
  /**
   * A line names the variable, but the file does not parse cleanly around
   * it (a quote another line closes): left exactly as it was, never
   * appended a second time. A human should look at the file.
   */
  | 'needs-review'

export type EnsureVarResult = {
  readonly name: string
  readonly action: EnsureVarAction
}

/**
 * Prefixes that frameworks inline into the browser bundle (Next.js, Vite,
 * Astro/SvelteKit, Expo). A secret under one of these names ships to every
 * visitor.
 */
export const CLIENT_EXPOSED_PREFIXES = [
  'NEXT_PUBLIC_',
  'VITE_',
  'PUBLIC_',
  'EXPO_PUBLIC_',
] as const

export function isClientExposedName(name: string): boolean {
  return CLIENT_EXPOSED_PREFIXES.some((prefix) => name.startsWith(prefix))
}

/** A secret was about to be written under a browser-exposed name. */
export class EnvSecretExposureError extends Error {
  readonly variable: string

  constructor(name: string) {
    super(
      `Refusing to store a secret in ${name}: the ${CLIENT_EXPOSED_PREFIXES.find((prefix) => name.startsWith(prefix)) ?? ''} prefix ships it to the browser.`
    )
    this.name = 'EnvSecretExposureError'
    this.variable = name
  }
}

/** `KEY=value`, `export KEY=value`, and dotenv's YAML-ish `KEY: value`. */
const VAR_LINE =
  /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)(?:\s*=\s*|:\s+)(.*)$/
const VALID_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Whether any physical line of `text` assigns `name` (`=` or `:`, with or
 * without `export`), however the lines around it parse. `name` is a
 * validated variable name (`VALID_NAME`): no regex metacharacters.
 */
function mentionsAssignment(text: string, name: string): boolean {
  const pattern = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*[=:]`)
  return text.split('\n').some((line) => pattern.test(line))
}

export function parseEnv(text: string): EnvFile {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const trailingNewline = text.endsWith('\n')
  // Split on LF only: a line keeps its own `\r`, so a file that mixes
  // endings serializes back exactly as it was read.
  const source = text === '' ? [] : text.split('\n')
  if (trailingNewline) {
    source.pop()
  }
  const lines: EnvLine[] = []
  for (let index = 0; index < source.length; index += 1) {
    const raw = source[index] ?? ''
    const line = raw.replace(/\r$/, '')
    const match = VAR_LINE.exec(line)
    if (match === null) {
      lines.push({ kind: 'other', raw })
      continue
    }
    const key = match[1] ?? ''
    let rest = match[2] ?? ''
    const quote = rest[0]
    if (quote === '"' || quote === "'" || quote === '`') {
      // A quoted value may continue over the following lines.
      const rawLines = [raw]
      let body = rest.slice(1)
      let close = findClosingQuote(body, quote)
      let end = index
      while (close === -1 && end + 1 < source.length) {
        end += 1
        const next = source[end] ?? ''
        rawLines.push(next)
        body = `${body}\n${next.replace(/\r$/, '')}`
        close = findClosingQuote(body, quote)
      }
      if (close !== -1) {
        index = end
        const inner = body.slice(0, close)
        const value = quote === '"' ? unescapeDouble(inner) : inner
        lines.push({ kind: 'var', key, value, raw: rawLines.join('\n') })
        continue
      }
      // Never closed: dotenv reads this one line as an unquoted value, and
      // the lines after it as their own assignments.
    }
    // An unquoted value ends at a ` #` comment, or is one (`KEY= # todo`).
    const comment = rest.search(/(?:^|\s)#/)
    if (comment !== -1) {
      rest = rest.slice(0, comment)
    }
    lines.push({ kind: 'var', key, value: rest.trim(), raw })
  }
  return { lines, eol, trailingNewline }
}

function findClosingQuote(body: string, quote: string): number {
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index]
    if (quote === '"' && char === '\\') {
      index += 1
      continue
    }
    if (char === quote) {
      return index
    }
  }
  return -1
}

function unescapeDouble(value: string): string {
  return value.replace(/\\([nrt"\\$])/g, (_, char: string) => {
    switch (char) {
      case 'n':
        return '\n'
      case 'r':
        return '\r'
      case 't':
        return '\t'
      default:
        return char
    }
  })
}

/** Each line's own ending (`raw` carries its `\r`); new lines use `eol`. */
export function serializeEnv(file: EnvFile): string {
  if (file.lines.length === 0) {
    return ''
  }
  const body = file.lines.map((line) => line.raw).join('\n')
  return file.trailingNewline ? `${body}\n` : body
}

/** The LAST assignment wins, as every dotenv loader reads it. */
export function getEnvValue(file: EnvFile, name: string): string | undefined {
  let value: string | undefined
  for (const line of file.lines) {
    if (line.kind === 'var' && line.key === name) {
      value = line.value
    }
  }
  return value
}

/** `NAME=value`, quoted only when the value needs it. */
export function formatEnvAssignment(name: string, value: string): string {
  if (/^[A-Za-z0-9_./:@+,=-]*$/.test(value)) {
    return `${name}=${value}`
  }
  if (!value.includes("'") && !/[\r\n]/.test(value)) {
    // Single quotes: literal, never `$`-expanded by dotenv-expand.
    return `${name}='${value}'`
  }
  const escaped = value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('$', '\\$')
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n')
  return `${name}="${escaped}"`
}

/**
 * Makes sure `name` has a value, without ever replacing one: absent →
 * appended (`added`), present but empty → set in place (`filled`),
 * present → untouched (`kept-existing`), named on a line the parser could
 * not read as an assignment → untouched (`needs-review`), never a second
 * copy. Secrets (the default) refuse a browser-exposed name before
 * anything changes.
 */
export function ensureVar(
  file: EnvFile,
  name: string,
  value: string,
  options: { readonly secret?: boolean } = {}
): { readonly file: EnvFile; readonly result: EnsureVarResult } {
  if (!VALID_NAME.test(name)) {
    throw new Error(`Invalid environment variable name: ${name}`)
  }
  if (options.secret !== false && isClientExposedName(name)) {
    throw new EnvSecretExposureError(name)
  }
  const existing = getEnvValue(file, name)
  if (existing !== undefined && existing !== '') {
    return { file, result: { name, action: 'kept-existing' } }
  }
  const assignment = formatEnvAssignment(name, value)
  if (existing === '') {
    let lastIndex = -1
    file.lines.forEach((line, index) => {
      if (line.kind === 'var' && line.key === name) {
        lastIndex = index
      }
    })
    const lines = file.lines.map((line, index) => {
      if (index !== lastIndex || line.kind !== 'var') {
        return line
      }
      const exported = /^\s*export\s/.test(line.raw)
      const cr = line.raw.endsWith('\r') ? '\r' : ''
      return {
        kind: 'var' as const,
        key: name,
        value,
        raw: `${exported ? 'export ' : ''}${assignment}${cr}`,
      }
    })
    return { file: { ...file, lines }, result: { name, action: 'filled' } }
  }
  if (mentionsAssignment(serializeEnv(file), name)) {
    return { file, result: { name, action: 'needs-review' } }
  }
  const cr = file.eol === '\r\n' ? '\r' : ''
  const previous = file.lines.map((line, index) =>
    // A file without a final newline gets one before the new line.
    !file.trailingNewline &&
    index === file.lines.length - 1 &&
    !line.raw.endsWith('\r')
      ? { ...line, raw: `${line.raw}${cr}` }
      : line
  )
  return {
    file: {
      ...file,
      trailingNewline: true,
      lines: [
        ...previous,
        { kind: 'var', key: name, value, raw: `${assignment}${cr}` },
      ],
    },
    result: { name, action: 'added' },
  }
}

/**
 * `ensureVar` over several variables, from file text (`null` = no file
 * yet) to file text. Results carry names and actions only.
 */
export function ensureEnvVars(
  text: string | null,
  vars: ReadonlyArray<{
    readonly name: string
    readonly value: string
    readonly secret?: boolean
  }>
): { readonly text: string; readonly results: readonly EnsureVarResult[] } {
  let file = parseEnv(text ?? '')
  const results: EnsureVarResult[] = []
  for (const entry of vars) {
    const next = ensureVar(
      file,
      entry.name,
      entry.value,
      entry.secret === undefined ? {} : { secret: entry.secret }
    )
    file = next.file
    results.push(next.result)
  }
  return { text: serializeEnv(file), results }
}
