import { PassThrough } from 'node:stream'
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
  printError,
  toErrorEnvelope,
  toExitCode,
} from '../../src/lib/errors'
import type { CliContext } from '../../src/lib/types'

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

  it('recognizes a timeout by name without requiring Error inheritance', () => {
    expect(toErrorEnvelope({ name: 'TimeoutError' })).toEqual({
      code: 'CLI_TIMEOUT',
      type: 'service_unavailable',
      message: 'The request timed out before the API responded.',
      suggestion:
        'Retry the request. Reuse the same Idempotency-Key for a POST request.',
    })
  })
})

// A trigger-fire `payload_mismatch` refusal: the part a caller needs is
// which field was wrong, and that lives in `details.errors[]`.
const PAYLOAD_MISMATCH_DETAILS = {
  errors: [
    {
      code: 'invalid_type',
      field: 'code',
      message: 'Field "code" must be a string',
      expectedType: 'string',
      actualType: 'number',
    },
    {
      code: 'missing_required',
      field: 'email',
      message: 'Field "email" is required',
    },
  ],
  warnings: [],
  payloadSchema: { type: 'object', fields: [] },
}

function payloadMismatch(): CliApiError {
  return new CliApiError({
    status: 400,
    code: 'INVALID_PAYLOAD',
    type: 'invalid_request',
    message: 'Payload validation failed.',
    suggestion: 'Fix the payload before sending it again.',
    requestId: 'req_9495a63f50df425883d0624b8b8a610a',
    details: PAYLOAD_MISMATCH_DETAILS,
  })
}

describe('toErrorEnvelope — details', () => {
  it('carries CliApiError details into the envelope verbatim', () => {
    expect(toErrorEnvelope(payloadMismatch())).toEqual({
      code: 'INVALID_PAYLOAD',
      type: 'invalid_request',
      message: 'Payload validation failed.',
      suggestion: 'Fix the payload before sending it again.',
      requestId: 'req_9495a63f50df425883d0624b8b8a610a',
      details: PAYLOAD_MISMATCH_DETAILS,
      status: 400,
    })
  })

  it('reads details off a BrewApiError structurally', () => {
    // The installed SDK predates `details`; a newer one exposes it as a
    // readonly property. The CLI reads it structurally so the typed
    // commands light up the moment the SDK bump lands, with no CLI change.
    const error = makeBrewApiError(400)
    Object.assign(error, { details: PAYLOAD_MISMATCH_DETAILS })

    expect(toErrorEnvelope(error).details).toEqual(PAYLOAD_MISMATCH_DETAILS)
  })

  it('omits details when the error carries none', () => {
    expect('details' in toErrorEnvelope(makeBrewApiError(500))).toBe(false)
  })
})

describe('printError — details', () => {
  function context(mode: 'human' | 'json'): {
    ctx: CliContext
    stderr: PassThrough
  } {
    const stderr = new PassThrough()
    return {
      stderr,
      ctx: {
        io: {
          stdout: new PassThrough(),
          stderr,
          isTtyOut: false,
          isTtyIn: false,
          env: {},
          readStdin: async () => '',
          readLine: async () => '',
        },
        mode,
        globals: {
          json: mode === 'json',
          quiet: true,
          yes: false,
          apiKey: undefined,
          brand: undefined,
          apiUrl: undefined,
        },
        client: () => {
          throw new Error('SDK client is not used by printError')
        },
        rawArgv: [],
      },
    }
  }

  it('human mode lists every field error under the message', () => {
    const { ctx, stderr } = context('human')

    printError(ctx, payloadMismatch())

    expect(String(stderr.read())).toBe(
      [
        'brew-cli: Payload validation failed.',
        '  - code: Field "code" must be a string (expected string, got number)',
        '  - email: Field "email" is required',
        'Fix the payload before sending it again.',
        'Request id: req_9495a63f50df425883d0624b8b8a610a',
        '',
      ].join('\n')
    )
  })

  it('json mode carries details inside the error envelope', () => {
    const { ctx, stderr } = context('json')

    printError(ctx, payloadMismatch())

    const parsed = JSON.parse(String(stderr.read())) as {
      error: { code: string; details: unknown }
    }
    expect(parsed.error.code).toBe('INVALID_PAYLOAD')
    expect(parsed.error.details).toEqual(PAYLOAD_MISMATCH_DETAILS)
  })

  it('human mode prints any other details shape as one JSON line', () => {
    const { ctx, stderr } = context('human')

    printError(
      ctx,
      new CliApiError({
        status: 409,
        code: 'FIELD_TYPE_MISMATCH',
        type: 'conflict',
        message: 'boom',
        details: { existingType: 'number' },
      })
    )

    expect(String(stderr.read())).toContain(
      'Details: {"existingType":"number"}'
    )
  })
})
