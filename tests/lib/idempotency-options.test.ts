import { describe, expect, it } from 'vitest'
import { requestOptions } from '../../src/lib/input'

describe('idempotency flag validation', () => {
  it.each(['', '   ', '\t', 'x'.repeat(101), 'bad\nkey'])(
    'rejects unsafe key %j',
    (key) => {
      expect(() => requestOptions({ idempotencyKey: key })).toThrow(
        '--idempotency-key'
      )
    }
  )
  it('normalizes the wire key and leaves missing keys to the SDK', () => {
    expect(requestOptions({ idempotencyKey: ' stable ' })).toEqual({
      idempotencyKey: 'stable',
    })
    expect(requestOptions({})).toBeUndefined()
  })
})
