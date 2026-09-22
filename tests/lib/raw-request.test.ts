import { PassThrough } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { CliApiError } from '../../src/lib/errors'
import { rawRequest, responseToApiError } from '../../src/lib/raw-request'
import type { CliContext } from '../../src/lib/types'

const API_KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'

function context(): CliContext {
  return {
    io: {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      isTtyOut: false,
      isTtyIn: false,
      env: { BREW_API_KEY: API_KEY },
      readStdin: async () => '',
      readLine: async () => '',
    },
    mode: 'json',
    globals: {
      json: true,
      quiet: true,
      yes: false,
      apiKey: undefined,
      brand: undefined,
      apiUrl: undefined,
    },
    client: () => {
      throw new Error('SDK client is not used by rawRequest')
    },
    rawArgv: [],
  }
}

describe('rawRequest', () => {
  it('auto-generates an idempotency key for POST requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      })
    )

    await rawRequest(context(), {
      method: 'POST',
      path: '/v1/emails/audit',
      body: { emailHtml: '<p>Hello</p>' },
    })

    const headers = new Headers(fetchSpy.mock.calls[0]?.[1]?.headers)
    expect(headers.get('idempotency-key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })

  it('forwards a caller-provided abort signal to fetch', async () => {
    const controller = new AbortController()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      })
    )

    const result = await rawRequest<{ readonly ok: boolean }>(context(), {
      method: 'POST',
      path: '/v1/emails/audit',
      body: { emailHtml: '<p>Hello</p>' },
      signal: controller.signal,
    })

    expect(result).toEqual({ ok: true })
    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBe(controller.signal)
  })
})

describe('responseToApiError', () => {
  it('maps the standard envelope field for field, details included', () => {
    const body = {
      error: {
        code: 'FIELD_TYPE_MISMATCH',
        type: 'conflict',
        message: "Field 'score' already exists with type number.",
        param: 'score',
        suggestion: 'Use the existing type or pick another name.',
        docs: 'https://docs.brew.new/api-reference/api/errors',
        details: { existingType: 'number', requestedType: 'string' },
      },
    }

    const error = responseToApiError(
      new Response(null, {
        status: 409,
        headers: { 'x-request-id': 'req_16ee218c36c0460d999ffee25c2d8d46' },
      }),
      body
    )

    expect(error).toBeInstanceOf(CliApiError)
    expect(error).toMatchObject({
      status: 409,
      code: 'FIELD_TYPE_MISMATCH',
      type: 'conflict',
      message: "Field 'score' already exists with type number.",
      param: 'score',
      suggestion: 'Use the existing type or pick another name.',
      docs: 'https://docs.brew.new/api-reference/api/errors',
      requestId: 'req_16ee218c36c0460d999ffee25c2d8d46',
      details: { existingType: 'number', requestedType: 'string' },
    })
    expect(error.body).toBe(body)
  })

  it('maps the legacy fire envelope: real code, status-derived type, details kept, no retry advice', () => {
    // `POST /v1/automations/triggers/{id}/fire` is the ONE endpoint outside
    // the `{ error }` convention. `details.errors[]` names the offending
    // fields — the part a caller needs, and the part this mapper dropped.
    const body = {
      success: false,
      status: 'payload_mismatch',
      code: 'INVALID_PAYLOAD',
      message: 'Payload validation failed.',
      triggerEventId: 'tri_signup',
      receivedAt: '2026-09-20T10:00:00.000Z',
      details: {
        errors: [
          {
            code: 'invalid_type',
            field: 'code',
            message: 'Field "code" must be a string',
            expectedType: 'string',
            actualType: 'number',
          },
        ],
        warnings: [],
        payloadSchema: {
          type: 'object',
          fields: [{ key: 'code', type: 'string', required: true }],
        },
      },
    }

    const error = responseToApiError(
      new Response(null, {
        status: 400,
        headers: { 'x-request-id': 'req_9495a63f50df425883d0624b8b8a610a' },
      }),
      body
    )

    expect(error).toMatchObject({
      status: 400,
      code: 'INVALID_PAYLOAD',
      type: 'invalid_request',
      message: 'Payload validation failed.',
      requestId: 'req_9495a63f50df425883d0624b8b8a610a',
    })
    expect(error.details).toEqual(body.details)
    expect(error.body).toBe(body)
    // The same body fails the same way on retry — never advise one.
    expect(error.suggestion).toBeDefined()
    expect(error.suggestion).not.toMatch(/retry/i)
  })

  it.each([
    [404, 'not_found'],
    [403, 'authorization_error'],
    [422, 'invalid_request'],
    // Unlisted client errors are still the caller's problem, never a
    // server fault.
    [405, 'invalid_request'],
    [415, 'invalid_request'],
    [429, 'rate_limit'],
    [500, 'internal_error'],
  ])('derives type %i → %s for a legacy body without one', (status, type) => {
    const error = responseToApiError(new Response(null, { status }), {
      success: false,
      status: 'failed',
      code: 'SOMETHING',
      message: 'something happened',
    })

    expect(error.code).toBe('SOMETHING')
    expect(error.type).toBe(type)
    expect(error.details).toBeUndefined()
  })

  it.each([408, 425, 429, 503])(
    'keeps retry advice for a transient %i without a suggestion of its own',
    (status) => {
      const error = responseToApiError(new Response(null, { status }), {
        success: false,
        status: 'failed',
        code: 'TRANSIENT',
        message: 'try again',
      })

      expect(error.suggestion).toMatch(/retry/i)
    }
  )

  it('a non-JSON body keeps the HTTP status and derives the type', () => {
    const error = responseToApiError(
      new Response(null, { status: 502 }),
      undefined
    )

    expect(error).toMatchObject({
      status: 502,
      code: 'HTTP_ERROR',
      type: 'internal_error',
      message: 'Request failed with status 502',
    })
    expect(error.details).toBeUndefined()
    expect(error.body).toBeUndefined()
  })
})
