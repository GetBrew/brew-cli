import { afterEach, describe, expect, it, vi } from 'vitest'
import { CliUsageError } from '../../src/lib/errors'
import {
  type DecodeOptions,
  decodeUtf8Text,
  type TextSource,
} from '../../src/lib/utf8'

const FILE = { flag: '--file', path: 'names.csv' } as const

function bytes(...parts: ReadonlyArray<string | readonly number[]>): Buffer {
  return Buffer.concat(
    parts.map((part) =>
      typeof part === 'string' ? Buffer.from(part) : Buffer.from(part)
    )
  )
}

/** The message a POSIX host prints, unless `options` says otherwise. */
function refusal(
  input: Uint8Array,
  source: TextSource,
  options: DecodeOptions = {}
): string {
  try {
    decodeUtf8Text(input, source, { platform: 'linux', ...options })
  } catch (error) {
    expect(error).toBeInstanceOf(CliUsageError)
    return (error as CliUsageError).message
  }
  throw new Error('expected a CliUsageError')
}

const EML_ADVICE =
  'An .eml must be UTF-8 or 7-bit (quoted-printable or base64); ' +
  'converting it would leave its declared charset wrong. ' +
  "Import the message's HTML, saved as UTF-8, instead."

afterEach(() => {
  vi.restoreAllMocks()
})

describe('decodeUtf8Text', () => {
  it('returns UTF-8 text exactly', () => {
    expect(decodeUtf8Text(bytes('José,“Zoë”,Jürgen ☕'), FILE)).toBe(
      'José,“Zoë”,Jürgen ☕'
    )
  })

  it('drops a leading UTF-8 byte-order mark', () => {
    expect(decodeUtf8Text(bytes([0xef, 0xbb, 0xbf], 'email\n'), FILE)).toBe(
      'email\n'
    )
  })

  it('refuses Windows-1252 bytes, naming the line and byte', () => {
    // "José" with é as Windows-1252 0xE9, after a UTF-8 line and a CRLF.
    const input = bytes('Prénom,email\r\n', 'Jos', [0xe9], ',j@x.com\r\n')
    expect(refusal(input, FILE)).toBe(
      '--file names.csv is not UTF-8 (line 2 has byte 0xE9), so nothing was sent. ' +
        'Save it as UTF-8 (in Excel: Save As > "CSV UTF-8"), or convert it. ' +
        "Excel's default CSV on Western Windows is Windows-1252: " +
        'iconv -f WINDOWS-1252 -t UTF-8 < names.csv > names-utf8.csv'
    )
  })

  it('counts lone-CR line endings, as in an Excel for Mac CSV', () => {
    const input = bytes('email,firstName\ra@x.com,Ann\rb@x.com,Jos', [0xe9])
    expect(refusal(input, FILE)).toContain('(line 3 has byte 0xE9)')
  })

  it.each([
    ['a truncated sequence at the end', bytes('ok\n', 'a', [0xe2, 0x82])],
    ['a lone continuation byte', bytes('ok\n', 'a', [0x82], 'b')],
    ['an encoded surrogate', bytes('ok\n', 'a', [0xed, 0xa0, 0x80])],
    ['an overlong encoding', bytes('ok\n', 'a', [0xc0, 0xaf])],
  ])('locates %s at the first bad byte', (_case, input) => {
    const byte = input[4]?.toString(16).toUpperCase()
    expect(refusal(input, FILE)).toContain(`(line 2 has byte 0x${byte})`)
  })

  it('names UTF-16 by its byte-order mark', () => {
    const input = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from('email\n', 'utf16le'),
    ])
    expect(refusal(input, { flag: '--file', path: 'my list.csv' })).toBe(
      "--file 'my list.csv' is UTF-16, not UTF-8, so nothing was sent. " +
        'Save it as UTF-8 (in Excel: Save As > "CSV UTF-8"), or convert it: ' +
        "iconv -f UTF-16 -t UTF-8 < 'my list.csv' > 'my list-utf8.csv'"
    )
  })

  it('leaves out the Excel hint for files that are not CSV', () => {
    const message = refusal(bytes('<p>Caf', [0xe9], '</p>'), {
      flag: '--file',
      path: 'email.html',
    })
    expect(message).not.toContain('Excel')
    expect(message).toContain(
      'Save it as UTF-8, or convert it. If it is Windows-1252: iconv -f WINDOWS-1252 -t UTF-8 < email.html > email-utf8.html'
    )
  })

  it('gives the Excel hint when the command says the file is CSV', () => {
    expect(
      refusal(
        bytes('Jos', [0xe9]),
        { flag: '--file', path: 'export.txt' },
        { kind: 'csv' }
      )
    ).toContain('in Excel: Save As > "CSV UTF-8"')
  })

  it('redirects input so iconv cannot read a leading-dash path as an option', () => {
    expect(
      refusal(bytes('Jos', [0xe9]), { flag: '--file', path: '-names.csv' })
    ).toContain('iconv -f WINDOWS-1252 -t UTF-8 < -names.csv > -names-utf8.csv')
  })

  it('names no source encoding when the bytes cannot be Windows-1252', () => {
    // "Hélène" in Mac Roman: é = 0x8E, è = 0x8F, which Windows-1252 leaves
    // undefined. Converting it as Windows-1252 would store "HŽlne".
    const macRoman = bytes('H', [0x8e], 'l', [0x8f], 'ne')
    expect(refusal(macRoman, FILE)).toBe(
      '--file names.csv is not UTF-8 (line 1 has byte 0x8E), so nothing was sent. ' +
        'Save it as UTF-8 (in Excel: Save As > "CSV UTF-8").'
    )
    expect(refusal(bytes('Jos', [0x8f]), 'stdin')).toBe(
      'stdin is not UTF-8 (line 1 has byte 0x8F), so nothing was sent. Pipe UTF-8 text.'
    )
  })

  it('prints no POSIX shell command on Windows', () => {
    const windows = { platform: 'win32' } as const
    expect(
      refusal(
        bytes('Jos', [0xe9]),
        { flag: '--file', path: 'C:\\data\\names.csv' },
        windows
      )
    ).toBe(
      "--file 'C:\\data\\names.csv' is not UTF-8 (line 1 has byte 0xE9), so nothing was sent. " +
        'Save it as UTF-8 (in Excel: Save As > "CSV UTF-8").'
    )
    expect(refusal(bytes('Jos', [0xe9]), 'stdin', windows)).toBe(
      'stdin is not UTF-8 (line 1 has byte 0xE9), so nothing was sent. Pipe UTF-8 text.'
    )
  })

  describe('an .eml, whose parts declare their own charset', () => {
    const EML = bytes(
      'Content-Type: text/html; charset=windows-1252\r\n',
      'Content-Transfer-Encoding: 8bit\r\n\r\n<p>Jos',
      [0xe9],
      '</p>'
    )

    it('is told to import its HTML, by extension', () => {
      expect(refusal(EML, { flag: '--file', path: 'Saved.EML' })).toBe(
        `--file Saved.EML is not UTF-8 (line 4 has byte 0xE9), so nothing was sent. ${EML_ADVICE}`
      )
    })

    it('is told the same on stdin or any path when the command says eml', () => {
      expect(refusal(EML, 'stdin', { kind: 'eml' })).toBe(
        `stdin is not UTF-8 (line 4 has byte 0xE9), so nothing was sent. ${EML_ADVICE}`
      )
      expect(
        refusal(EML, { flag: '--file', path: 'saved-message' }, { kind: 'eml' })
      ).toContain(EML_ADVICE)
    })
  })

  it('tells stdin callers to pipe UTF-8', () => {
    expect(refusal(bytes('Jos', [0xe9]), 'stdin')).toBe(
      'stdin is not UTF-8 (line 1 has byte 0xE9), so nothing was sent. ' +
        'Pipe UTF-8 text, e.g. through iconv -f WINDOWS-1252 -t UTF-8.'
    )
  })

  it('rethrows a decoder failure on valid UTF-8 instead of blaming the encoding', () => {
    // Node throws ERR_STRING_TOO_LONG decoding a valid file over ~512 MiB.
    const tooLong = new Error('Cannot create a string longer than 0x1fffffe8')
    vi.spyOn(TextDecoder.prototype, 'decode').mockImplementation(() => {
      throw tooLong
    })
    expect(() => decodeUtf8Text(bytes('José'), FILE)).toThrow(tooLong)
  })
})
