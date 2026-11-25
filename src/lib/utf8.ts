import { extname, join, parse } from 'node:path'
import { CliUsageError } from './errors'
import { shellQuote } from './rerun'

export type TextSource =
  | { readonly flag: string; readonly path: string }
  | 'stdin'

export type TextKind = 'csv' | 'eml'

export type DecodeOptions = {
  readonly kind?: TextKind | undefined
  readonly platform?: NodeJS.Platform
}

const decoder = new TextDecoder('utf-8', { fatal: true })

export function decodeUtf8Text(
  bytes: Uint8Array,
  source: TextSource,
  options: DecodeOptions = {}
): string {
  try {
    return decoder.decode(bytes)
  } catch (error) {
    const offset = firstInvalidOffset(bytes)
    if (offset === -1) {
      throw error
    }
    throw new CliUsageError(notUtf8Message(bytes, offset, source, options))
  }
}

const UNDEFINED_IN_1252 = new Set([0x81, 0x8d, 0x8f, 0x90, 0x9d])

function notUtf8Message(
  bytes: Uint8Array,
  offset: number,
  source: TextSource,
  options: DecodeOptions
): string {
  const utf16 =
    (bytes[0] === 0xff && bytes[1] === 0xfe) ||
    (bytes[0] === 0xfe && bytes[1] === 0xff)
  const name =
    source === 'stdin' ? 'stdin' : `${source.flag} ${shellQuote(source.path)}`
  const what = utf16
    ? `${name} is UTF-16, not UTF-8, so nothing was sent.`
    : `${name} is not UTF-8 (${where(bytes, offset)}), so nothing was sent.`
  const kind = options.kind ?? kindOf(source)
  if (kind === 'eml') {
    return `${what} An .eml must be UTF-8 or 7-bit (quoted-printable or base64); converting it would leave its declared charset wrong. Import the message's HTML, saved as UTF-8, instead.`
  }
  const from = utf16
    ? 'UTF-16'
    : bytes.some((byte) => UNDEFINED_IN_1252.has(byte))
      ? undefined
      : 'WINDOWS-1252'
  const iconv =
    from !== undefined && (options.platform ?? process.platform) !== 'win32'
  if (source === 'stdin') {
    return iconv
      ? `${what} Pipe UTF-8 text, e.g. through iconv -f ${from} -t UTF-8.`
      : `${what} Pipe UTF-8 text.`
  }
  const save =
    kind === 'csv'
      ? 'Save it as UTF-8 (in Excel: Save As > "CSV UTF-8")'
      : 'Save it as UTF-8'
  if (!iconv) {
    return `${what} ${save}.`
  }
  const guess = utf16
    ? ':'
    : kind === 'csv'
      ? ". Excel's default CSV on Western Windows is Windows-1252:"
      : '. If it is Windows-1252:'
  const command = `iconv -f ${from} -t UTF-8 < ${shellQuote(source.path)} > ${shellQuote(utf8Copy(source.path))}`
  return `${what} ${save}, or convert it${guess} ${command}`
}

function kindOf(source: TextSource): TextKind | undefined {
  if (source === 'stdin') {
    return
  }
  const ext = extname(source.path).toLowerCase()
  return ext === '.csv' ? 'csv' : ext === '.eml' ? 'eml' : undefined
}

function where(bytes: Uint8Array, offset: number): string {
  let line = 1
  for (let i = 0; i < offset; i++) {
    if (bytes[i] === 0x0a || (bytes[i] === 0x0d && bytes[i + 1] !== 0x0a)) {
      line++
    }
  }
  const byte = (bytes[offset] ?? 0).toString(16).toUpperCase().padStart(2, '0')
  return `line ${line} has byte 0x${byte}`
}

function firstInvalidOffset(bytes: Uint8Array): number {
  let i = 0
  while (i < bytes.length) {
    const lead = bytes[i] ?? 0
    if (lead < 0x80) {
      i++
      continue
    }
    let length: number
    let low = 0x80
    let high = 0xbf
    if (lead >= 0xc2 && lead <= 0xdf) {
      length = 2
    } else if (lead >= 0xe0 && lead <= 0xef) {
      length = 3
      if (lead === 0xe0) low = 0xa0
      if (lead === 0xed) high = 0x9f
    } else if (lead >= 0xf0 && lead <= 0xf4) {
      length = 4
      if (lead === 0xf0) low = 0x90
      if (lead === 0xf4) high = 0x8f
    } else {
      return i
    }
    for (let k = 1; k < length; k++) {
      const next = bytes[i + k]
      const min = k === 1 ? low : 0x80
      const max = k === 1 ? high : 0xbf
      if (next === undefined || next < min || next > max) {
        return i
      }
    }
    i += length
  }
  return -1
}

function utf8Copy(path: string): string {
  const { dir, name, ext } = parse(path)
  return join(dir, `${name}-utf8${ext}`)
}
