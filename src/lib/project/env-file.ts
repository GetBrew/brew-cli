/**
 * Dotenv files (`.env.local`, `.env.example`) edited without losing what the
 * user wrote: comments, blank lines, order, quoting and line endings all
 * round-trip byte for byte, and a variable is only ever ADDED (or filled
 * when present but empty), never replaced.
 *
 * Values are secrets. Nothing here returns or prints one: results name the
 * variable and what happened to it, never its value.
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

const VAR_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/
const VALID_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

export function parseEnv(text: string): EnvFile {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const normalized = text.replaceAll('\r\n', '\n')
  const trailingNewline = normalized.endsWith('\n')
  const source = normalized === '' ? [] : normalized.split('\n')
  if (trailingNewline) {
    source.pop()
  }
  const lines: EnvLine[] = []
  for (let index = 0; index < source.length; index += 1) {
    const line = source[index] ?? ''
    const match = VAR_LINE.exec(line)
    if (match === null) {
      lines.push({ kind: 'other', raw: line })
      continue
    }
    const key = match[1] ?? ''
    let rest = match[2] ?? ''
    const quote = rest[0]
    if (quote === '"' || quote === "'" || quote === '`') {
      // A quoted value may continue over the following lines.
      const rawLines = [line]
      let body = rest.slice(1)
      let close = findClosingQuote(body, quote)
      while (close === -1 && index + 1 < source.length) {
        index += 1
        const next = source[index] ?? ''
        rawLines.push(next)
        body = `${body}\n${next}`
        close = findClosingQuote(body, quote)
      }
      const inner = close === -1 ? body : body.slice(0, close)
      const value = quote === '"' ? unescapeDouble(inner) : inner
      lines.push({ kind: 'var', key, value, raw: rawLines.join('\n') })
      continue
    }
    const comment = rest.search(/\s#/)
    if (comment !== -1) {
      rest = rest.slice(0, comment)
    }
    lines.push({ kind: 'var', key, value: rest.trim(), raw: line })
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

export function serializeEnv(file: EnvFile): string {
  if (file.lines.length === 0) {
    return ''
  }
  const body = file.lines.map((line) => line.raw).join('\n')
  const text = file.trailingNewline ? `${body}\n` : body
  return file.eol === '\r\n' ? text.replaceAll('\n', '\r\n') : text
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
 * present → untouched (`kept-existing`). Secrets (the default) refuse a
 * browser-exposed name before anything changes.
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
      return {
        kind: 'var' as const,
        key: name,
        value,
        raw: `${exported ? 'export ' : ''}${assignment}`,
      }
    })
    return { file: { ...file, lines }, result: { name, action: 'filled' } }
  }
  return {
    file: {
      ...file,
      // A file without a final newline gets one, so the new line stands alone.
      trailingNewline: true,
      lines: [
        ...file.lines,
        { kind: 'var', key: name, value, raw: assignment },
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
