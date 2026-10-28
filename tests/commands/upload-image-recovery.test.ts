import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BrewApiError,
  BrewConnectionError,
  BrewParseError,
} from '@brew.new/sdk'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { buildUploadRetryCommand } from '../../src/lib/confirm'
import { CliInterruptError, toErrorEnvelope } from '../../src/lib/errors'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const API = 'https://brew.new/api/v1/content'
const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const UPLOAD_ID = 'imgup_V1StGXR8_Z5jdHi6B-myT'
const BYTES_URL = 'https://uploads.brew.test/upload'
const TOKEN = 'private-upload-token'
const IMAGE = {
  url: 'https://cdn.brew.new/recovered.png',
  width: 16,
  height: 16,
  aspectRatio: '1:1',
  assetId: 'original-asset',
}

function environment(): Record<string, string> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-recovery-')),
    BREW_API_KEY: KEY,
  }
}

function inputFile(): string {
  const path = join(mkdtempSync(join(tmpdir(), 'brew-cli-image-')), 'logo.png')
  writeFileSync(path, new Uint8Array([137, 80, 78, 71]))
  return path
}

function errorOf(stderr: string): Record<string, unknown> {
  const line = stderr.trim().split('\n').at(-1) ?? ''
  const parsed: { error: Record<string, unknown> } = JSON.parse(line)
  return parsed.error
}

function flow(finalize: (request: Request) => Response) {
  const seen = { opens: 0, bytes: 0, adds: 0 }
  server.use(
    http.post(`${API}/image-uploads`, () => {
      seen.opens++
      return HttpResponse.json(
        {
          uploadId: UPLOAD_ID,
          uploadUrl: `${BYTES_URL}?uploadId=${UPLOAD_ID}&token=${TOKEN}`,
          expiresAt: '2026-10-28T12:15:00Z',
          maxBytes: 20_000_000,
        },
        { status: 201 }
      )
    }),
    http.post(BYTES_URL, () => {
      seen.bytes++
      return HttpResponse.json({ status: 'uploaded' })
    }),
    http.post(`${API}/add-image`, ({ request }) => {
      seen.adds++
      return finalize(request)
    })
  )
  return seen
}

describe('local-image finalization recovery across CLI surfaces', () => {
  it('recovers a lost result with the installed 13.3 SDK and no new upload', async () => {
    let key: string | null = null
    const bodies: Array<Promise<unknown>> = []
    const seen = flow((request) => {
      key ??= request.headers.get('idempotency-key')
      expect(request.headers.get('idempotency-key')).toBe(key)
      bodies.push(request.json())
      return HttpResponse.json(IMAGE)
    })
    const originalFetch = globalThis.fetch
    let shouldLoseAnswer = true
    globalThis.fetch = async (input, init) => {
      const response = await originalFetch(input, init)
      if (String(input) === `${API}/add-image` && shouldLoseAnswer) {
        shouldLoseAnswer = false
        expect(await response.json()).toEqual(IMAGE)
        throw new TypeError('The successful final answer was lost.')
      }
      return response
    }
    const env = environment()
    try {
      const failed = await runCli(
        [
          'content',
          'upload-image',
          inputFile(),
          '--max-retries',
          '0',
          '--quiet',
        ],
        { env }
      )
      expect(failed.code).toBe(1)
      expect(failed.stdout).toBe('')
      const error = errorOf(failed.stderr)
      expect(error).toMatchObject({
        code: 'CLI_CONNECTION',
        uploadId: UPLOAD_ID,
        idempotencyKey: key,
      })
      expect(error.retryCommand).toBe(
        `brew-cli content add-image --upload-id ${UPLOAD_ID} --idempotency-key ${String(key)}`
      )
      const recovered = await runCli(
        String(error.retryCommand).split(' ').slice(1),
        { env }
      )
      expect(recovered.code).toBe(0)
      expect(recovered.json).toEqual(IMAGE)
      expect(seen).toEqual({ opens: 1, bytes: 1, adds: 2 })
      expect(await Promise.all(bodies)).toEqual([
        { uploadId: UPLOAD_ID },
        { uploadId: UPLOAD_ID },
      ])
      expect(failed.stderr).not.toContain(TOKEN)
      expect(failed.stderr).not.toContain(KEY)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it.each(['SIGINT', 'SIGTERM'] as const)(
    'keeps recovery state when %s cancels finalization',
    async (signal) => {
      const controller = new AbortController()
      let key: string | null = null
      flow((request) => {
        key = request.headers.get('idempotency-key')
        controller.abort(new CliInterruptError(signal))
        return HttpResponse.json(IMAGE)
      })
      const result = await runCli(
        ['content', 'upload-image', inputFile(), '--quiet'],
        { env: environment(), signal: controller.signal }
      )
      expect(result.code).toBe(signal === 'SIGINT' ? 130 : 143)
      expect(errorOf(result.stderr)).toMatchObject({
        code: 'CLI_INTERRUPTED',
        uploadId: UPLOAD_ID,
        idempotencyKey: key,
        retryCommand: `brew-cli content add-image --upload-id ${UPLOAD_ID} --idempotency-key ${String(key)}`,
      })
      expect(result.stderr).not.toContain(TOKEN)
    }
  )

  it('recognizes a malformed final result and preserves brand and API target', async () => {
    flow(
      () =>
        new HttpResponse('{broken', {
          headers: { 'x-request-id': 'req_parse' },
        })
    )
    const result = await runCli(
      [
        'content',
        'upload-image',
        inputFile(),
        '--quiet',
        '--brand',
        'brand_one',
        '--api-url',
        'https://brew.new/api',
        '--api-key',
        KEY,
      ],
      { env: environment() }
    )
    expect(result.code).toBe(1)
    const error = errorOf(result.stderr)
    expect(error).toMatchObject({
      code: 'UNEXPECTED_RESPONSE',
      status: 200,
      requestId: 'req_parse',
      uploadId: UPLOAD_ID,
    })
    expect(error.idempotencyKey).toEqual(expect.any(String))
    expect(error.retryCommand).toBe(
      `brew-cli content add-image --upload-id ${UPLOAD_ID} --idempotency-key ${String(error.idempotencyKey)} --brand brand_one --api-url https://brew.new/api`
    )
    expect(result.stderr).not.toContain(KEY)
  })

  it.each(['content', 'api'] as const)(
    'offers finalization recovery after a %s add-image request times out',
    async (surface) => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = (input, init) => {
        if (String(input) !== `${API}/add-image`)
          return originalFetch(input, init)
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          if (signal?.aborted) reject(signal.reason)
          else
            signal?.addEventListener('abort', () => reject(signal.reason), {
              once: true,
            })
        })
      }
      try {
        const argv =
          surface === 'content'
            ? ['content', 'add-image', '--upload-id', UPLOAD_ID]
            : [
                'api',
                'POST',
                '/v1/content/add-image',
                '--data',
                JSON.stringify({ uploadId: UPLOAD_ID }),
                '--yes',
                '--header',
                'X-Brand-Id: raw_brand',
              ]
        const result = await runCli(
          [
            ...argv,
            '--idempotency-key',
            'stable-key',
            '--timeout',
            '20ms',
            '--quiet',
          ],
          { env: environment() }
        )
        expect(result.code).toBe(1)
        expect(errorOf(result.stderr)).toMatchObject({
          code: 'CLI_TIMEOUT',
          uploadId: UPLOAD_ID,
          idempotencyKey: 'stable-key',
          retryCommand: `brew-cli content add-image --upload-id ${UPLOAD_ID} --idempotency-key stable-key${surface === 'api' ? ' --brand raw_brand' : ''}`,
        })
      } finally {
        globalThis.fetch = originalFetch
      }
    }
  )

  it('shows the recovery command in human mode', async () => {
    flow(() => HttpResponse.error())
    const result = await runCli(
      ['content', 'upload-image', inputFile(), '--max-retries', '0', '--quiet'],
      { env: environment(), ttyOut: true }
    )
    expect(result.stderr).toContain(
      `Re-run: brew-cli content add-image --upload-id ${UPLOAD_ID} --idempotency-key `
    )
    expect(result.stderr).not.toContain(TOKEN)
  })

  it('preserves definite refusals without suggesting an ineffective replay', async () => {
    flow(() =>
      HttpResponse.json(
        {
          error: {
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Different body.',
            suggestion: 'Reuse the original payload.',
          },
        },
        { status: 409 }
      )
    )
    const result = await runCli(
      ['content', 'upload-image', inputFile(), '--quiet'],
      { env: environment() }
    )
    const error = errorOf(result.stderr)
    expect(error).toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      uploadId: UPLOAD_ID,
      suggestion: 'Reuse the original payload.',
    })
    expect(error.idempotencyKey).toEqual(expect.any(String))
    expect(error.retryCommand).toBeUndefined()
  })

  it('does not expose finalization metadata for a failed bytes upload', async () => {
    flow(() => HttpResponse.json(IMAGE))
    server.use(http.post(BYTES_URL, () => HttpResponse.error()))
    const result = await runCli(
      ['content', 'upload-image', inputFile(), '--max-retries', '0', '--quiet'],
      { env: environment() }
    )
    const error = errorOf(result.stderr)
    expect(error.uploadId).toBeUndefined()
    expect(error.idempotencyKey).toBeUndefined()
    expect(error.retryCommand).toBeUndefined()
    expect(result.stderr).not.toContain(TOKEN)
  })
})

describe('newer SDK recovery metadata', () => {
  it('quotes the recovery key and target selectors as shell arguments', () => {
    expect(
      buildUploadRetryCommand({
        uploadId: UPLOAD_ID,
        idempotencyKey: 'key with spaces',
        brand: 'brand with spaces',
        apiUrl: 'https://brew.test/api?tenant=one&mode=two',
      })
    ).toBe(
      `brew-cli content add-image --upload-id ${UPLOAD_ID} --idempotency-key 'key with spaces' --brand 'brand with spaces' --api-url 'https://brew.test/api?tenant=one&mode=two'`
    )
  })
  it.each(['api', 'connection', 'parse'] as const)(
    'preserves %s recovery fields without a recorder',
    (kind) => {
      const errors = {
        api: BrewApiError.fromResponse({
          status: 500,
          headers: new Headers(),
          body: null,
          idempotencyKey: 'original-key',
        }),
        connection: new BrewConnectionError({
          method: 'POST',
          url: `${API}/add-image`,
          attempts: 1,
          idempotencyKey: 'original-key',
        }),
        parse: new BrewParseError({ status: 200, bodyPreview: '{broken' }),
      }
      // The published SDK predates these fields. Newer SDKs set them when
      // constructing errors; the CLI reads the same public shape.
      const error = Object.assign(errors[kind], {
        uploadId: UPLOAD_ID,
        idempotencyKey: 'original-key',
      })
      expect(toErrorEnvelope(error)).toMatchObject({
        uploadId: UPLOAD_ID,
        idempotencyKey: 'original-key',
      })
    }
  )
})
