import { describe, expect, it } from 'vitest'
import { flagString, isInputEnvelope, mergeInput } from '../../src/lib/input'

describe('string flag presence', () => {
  it.each(['', ' ', 'value'])('preserves the explicit string %j', (value) => {
    expect(flagString(value)).toBe(value)
  })

  it.each([undefined, null, false, 0, {}, []])(
    'does not convert non-string %j into a string',
    (value) => {
      expect(flagString(value)).toBeUndefined()
    }
  )

  it('overrides JSON with supplied values and skips only undefined', () => {
    expect(
      mergeInput(
        {
          text: 'old',
          enabled: true,
          count: 1,
          nullable: 'old',
          omitted: 'keep',
        },
        {
          text: flagString(''),
          enabled: false,
          count: 0,
          nullable: null,
          omitted: undefined,
        }
      )
    ).toEqual({
      text: '',
      enabled: false,
      count: 0,
      nullable: null,
      omitted: 'keep',
    })
  })
})

describe('request envelope detection', () => {
  const keys = { payload: true, enforcement: true } as const

  it('requires its own wrapper key and only canonical request keys', () => {
    expect(isInputEnvelope({ payload: {} }, 'payload', keys)).toBe(true)
    expect(
      isInputEnvelope({ payload: {}, enforcement: 'strict' }, 'payload', keys)
    ).toBe(true)
    expect(isInputEnvelope({ enforcement: 'strict' }, 'payload', keys)).toBe(
      false
    )
    expect(
      isInputEnvelope({ payload: {}, email: 'data' }, 'payload', keys)
    ).toBe(false)
    const inherited: Record<string, unknown> = { enforcement: 'strict' }
    Object.setPrototypeOf(inherited, { payload: {} })
    expect(isInputEnvelope(inherited, 'payload', keys)).toBe(false)
  })

  it.each([undefined, null, '', false, 0, []])(
    'keeps malformed wrapper value %j in its request envelope',
    (payload) => {
      expect(isInputEnvelope({ payload }, 'payload', keys)).toBe(true)
    }
  )
})
