import { BrewApiError } from '@brew.new/sdk'
import { describe, expect, it } from 'vitest'
import {
  CliApiError,
  CliAuthError,
  CliUsageError,
  ConfirmationRequiredError,
  EXIT_AUTH,
  EXIT_CONFIRM,
  EXIT_RUNTIME,
  EXIT_USAGE,
  toErrorEnvelope,
  toExitCode,
} from '../../src/lib/errors'

function makeBrewApiError(status: number): BrewApiError {
  return new BrewApiError({
    message: 'boom',
    status,
    code: 'SOMETHING_BROKE',
    type: 'internal_error' as BrewApiError['type'],
    param: undefined,
    suggestion: '',
    docs: '',
    requestId: 'req_123',
    retryAfter: undefined,
  })
}

describe('toExitCode', () => {
  it('maps 401/403 API errors to the auth exit code', () => {
    expect(toExitCode(makeBrewApiError(401))).toBe(EXIT_AUTH)
    expect(toExitCode(makeBrewApiError(403))).toBe(EXIT_AUTH)
  })

  it('maps other API errors to the runtime exit code', () => {
    expect(toExitCode(makeBrewApiError(404))).toBe(EXIT_RUNTIME)
    expect(toExitCode(makeBrewApiError(500))).toBe(EXIT_RUNTIME)
  })

  it('maps CLI error classes to their dedicated exit codes', () => {
    expect(toExitCode(new CliUsageError('bad'))).toBe(EXIT_USAGE)
    expect(toExitCode(new CliAuthError('no key', 'login'))).toBe(EXIT_AUTH)
    expect(
      toExitCode(
        new ConfirmationRequiredError({
          confirmationRequired: true,
          command: 'brew-cli contacts delete',
          summary: 'Delete jane@example.com.',
          confirmCommand: 'brew-cli contacts delete jane@example.com --yes',
        })
      )
    ).toBe(EXIT_CONFIRM)
    expect(
      toExitCode(
        new CliApiError({
          status: 401,
          code: 'X',
          type: 'authentication_error',
          message: 'x',
        })
      )
    ).toBe(EXIT_AUTH)
    expect(toExitCode(new Error('anything'))).toBe(EXIT_RUNTIME)
  })
})

describe('toErrorEnvelope', () => {
  it('keeps API error fields and drops empty ones', () => {
    const envelope = toErrorEnvelope(makeBrewApiError(500))
    expect(envelope).toEqual({
      code: 'SOMETHING_BROKE',
      type: 'internal_error',
      message: 'boom',
      requestId: 'req_123',
      status: 500,
    })
  })

  it('wraps unknown errors without leaking internals', () => {
    const envelope = toErrorEnvelope(new Error('ECONNRESET deep stack'))
    expect(envelope.code).toBe('CLI_UNEXPECTED')
    expect(envelope.type).toBe('internal_error')
  })
})
