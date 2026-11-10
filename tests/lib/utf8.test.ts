import { describe, expect, it } from 'vitest'
import { CliUsageError } from '../../src/lib/errors'
import { decodeUtf8Text } from '../../src/lib/utf8'

const FILE = { flag: '--file', path: 'names.csv' } as const

function bytes(...parts: ReadonlyArray<string | readonly number[]>): Buffer {
  return Buffer.concat(
    parts.map((part) =>
      typeof part === 'string' ? Buffer.from(part) : Buffer.from(part)
    )
  )
}

function failure(run: () => unknown): CliUsageError {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(CliUsageError)
    return error as CliUsageError
  }
  throw new Error('expected a CliUsageError')
}

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
    const error = failure(() => decodeUtf8Text(input, FILE))
    expect(error.message).toBe(
      '--file names.csv is not UTF-8 (line 2 has byte 0xE9), so nothing was sent. ' +
        'Save it as UTF-8 (in Excel: Save As > "CSV UTF-8"), or convert it. ' +
        "Excel's default CSV on Western Windows is Windows-1252: " +
        'iconv -f WINDOWS-1252 -t UTF-8 < names.csv > names-utf8.csv'
    )
  })

  it.each([
    ['a truncated sequence at the end', bytes('ok\n', 'a', [0xe2, 0x82])],
    ['a lone continuation byte', bytes('ok\n', 'a', [0x82], 'b')],
    ['an encoded surrogate', bytes('ok\n', 'a', [0xed, 0xa0, 0x80])],
    ['an overlong encoding', bytes('ok\n', 'a', [0xc0, 0xaf])],
  ])('locates %s at the first bad byte', (_case, input) => {
    const error = failure(() => decodeUtf8Text(input, FILE))
    const byte = input[4]?.toString(16).toUpperCase()
    expect(error.message).toContain(`(line 2 has byte 0x${byte})`)
  })

  it('names UTF-16 by its byte-order mark', () => {
    const input = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from('email\n', 'utf16le'),
    ])
    const error = failure(() =>
      decodeUtf8Text(input, { flag: '--file', path: 'my list.csv' })
    )
    expect(error.message).toBe(
      "--file 'my list.csv' is UTF-16, not UTF-8, so nothing was sent. " +
        'Save it as UTF-8 (in Excel: Save As > "CSV UTF-8"), or convert it: ' +
        "iconv -f UTF-16 -t UTF-8 < 'my list.csv' > 'my list-utf8.csv'"
    )
  })

  it('leaves out the Excel hint for files that are not CSV', () => {
    const error = failure(() =>
      decodeUtf8Text(bytes('<p>Caf', [0xe9], '</p>'), {
        flag: '--file',
        path: 'email.html',
      })
    )
    expect(error.message).not.toContain('Excel')
    expect(error.message).toContain(
      'Save it as UTF-8, or convert it. If it is Windows-1252: iconv -f WINDOWS-1252 -t UTF-8 < email.html > email-utf8.html'
    )
  })

  it('redirects input so iconv cannot read a leading-dash path as an option', () => {
    const error = failure(() =>
      decodeUtf8Text(bytes('Jos', [0xe9]), {
        flag: '--file',
        path: '-names.csv',
      })
    )
    expect(error.message).toContain(
      'iconv -f WINDOWS-1252 -t UTF-8 < -names.csv > -names-utf8.csv'
    )
  })

  it('tells stdin callers to pipe UTF-8', () => {
    const error = failure(() => decodeUtf8Text(bytes('Jos', [0xe9]), 'stdin'))
    expect(error.message).toBe(
      'stdin is not UTF-8 (line 1 has byte 0xE9), so nothing was sent. ' +
        'Pipe UTF-8 text, e.g. through iconv -f WINDOWS-1252 -t UTF-8.'
    )
  })
})
