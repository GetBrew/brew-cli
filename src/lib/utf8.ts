import { extname, join, parse } from 'node:path'
import { CliUsageError } from './errors'
import { shellQuote } from './rerun'

/** Where the bytes came from: a `--file`-style flag's path, or stdin. */
export type TextSource =
  | { readonly flag: string; readonly path: string }
  | 'stdin'

const decoder = new TextDecoder('utf-8', { fatal: true })

/**
 * Decodes `--file` or stdin bytes as UTF-8 and refuses any that are not.
 *
 * A lenient decode turns every non-ASCII byte of a Windows-1252 file (Excel's
 * default "CSV" on a Western-locale Windows) into U+FFFD before the request
 * leaves the machine. The API stores the string it is sent and answers 2xx,
 * so the CLI is the last place that still holds the original bytes and can
 * tell. A leading UTF-8 byte-order mark is dropped.
 */
export function decodeUtf8Text(bytes: Uint8Array, source: TextSource): string {
  try {
    return decoder.decode(bytes)
  } catch {
    throw new CliUsageError(notUtf8Message(bytes, source))
  }
}

function notUtf8Message(bytes: Uint8Array, source: TextSource): string {
  const utf16 =
    (bytes[0] === 0xff && bytes[1] === 0xfe) ||
    (bytes[0] === 0xfe && bytes[1] === 0xff)
  const from = utf16 ? 'UTF-16' : 'WINDOWS-1252'
  const name =
    source === 'stdin' ? 'stdin' : `${source.flag} ${shellQuote(source.path)}`
  const what = utf16
    ? `${name} is UTF-16, not UTF-8, so nothing was sent.`
    : `${name} is not UTF-8${where(bytes)}, so nothing was sent.`
  if (source === 'stdin') {
    return `${what} Pipe UTF-8 text, e.g. through iconv -f ${from} -t UTF-8.`
  }
  const ext = extname(source.path).toLowerCase()
  if (ext === '.eml') {
    // Brew decodes each MIME part by the charset its headers declare, so a
    // re-encoded file would still import garbled, with no error.
    return `${what} An .eml must be UTF-8 or 7-bit (quoted-printable or base64); converting it would leave its declared charset wrong. Save the message's HTML as UTF-8 and import that instead.`
  }
  const isCsv = ext === '.csv'
  const save = isCsv
    ? 'Save it as UTF-8 (in Excel: Save As > "CSV UTF-8"), or convert it'
    : 'Save it as UTF-8, or convert it'
  const guess = utf16
    ? ':'
    : isCsv
      ? ". Excel's default CSV on Western Windows is Windows-1252:"
      : '. If it is Windows-1252:'
  // Redirection, not an operand: iconv would parse a path like `-x.csv` as an option.
  const command = `iconv -f ${from} -t UTF-8 < ${shellQuote(source.path)} > ${shellQuote(utf8Copy(source.path))}`
  return `${what} ${save}${guess} ${command}`
}

/** ` (line N has byte 0xXX)` for the first byte that starts no valid sequence. */
function where(bytes: Uint8Array): string {
  const offset = firstInvalidOffset(bytes)
  if (offset === -1) {
    return ''
  }
  let line = 1
  for (let i = 0; i < offset; i++) {
    if (bytes[i] === 0x0a) {
      line++
    }
  }
  const byte = (bytes[offset] ?? 0).toString(16).toUpperCase().padStart(2, '0')
  return ` (line ${line} has byte 0x${byte})`
}

/** The offset of the first ill-formed sequence (Unicode Table 3-7), or -1. */
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
