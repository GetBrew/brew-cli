import { mkdirSync, mkdtempSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { brandDeleteImageCommand } from '../../src/commands/brand/delete-image'
import { contentAddImageCommand } from '../../src/commands/content/add-image'
import { contentCreateImageUploadCommand } from '../../src/commands/content/create-image-upload'
import { contentUploadImageCommand } from '../../src/commands/content/upload-image'
import { server } from '../helpers/msw-server'
import {
  type RunCliOptions,
  type RunCliResult,
  runCli,
} from '../helpers/run-cli'

/**
 * The brand image library writes (brew-v2#1817, brew-v2#1819): delete one
 * image, add one from a URL / a batch / an upload, open an upload, and the
 * one-call local-file upload.
 */

const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'
const API = 'https://brew.new/api'
const ASSET_ID = '5bc912f9'
const UPLOAD_ID = 'imgup_V1StGXR8_Z5jdHi6B-myT'
/** The credential an upload URL carries in its query: never printed. */
const UPLOAD_TOKEN = 's3cr3t-upload-token-9b1c4f6e'
const UPLOAD_ENDPOINT = 'https://uploads.brew.test/uploads/brand-image'
const UPLOAD_URL = `${UPLOAD_ENDPOINT}?uploadId=${UPLOAD_ID}&token=${UPLOAD_TOKEN}`
const EXPIRES_AT = '2026-10-01T18:15:00.000Z'
const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
])
const ADDED = {
  url: 'https://cdn.brew.new/brand/logo.png',
  width: 800,
  height: 600,
  aspectRatio: '4:3',
  assetId: ASSET_ID,
}
const TICKET = {
  uploadId: UPLOAD_ID,
  uploadUrl: UPLOAD_URL,
  expiresAt: EXPIRES_AT,
  maxBytes: 20_000_000,
}

const EXTRA = [
  brandDeleteImageCommand,
  contentAddImageCommand,
  contentCreateImageUploadCommand,
  contentUploadImageCommand,
]

function cli(
  argv: readonly string[],
  options: Omit<RunCliOptions, 'env' | 'extraCommands'> = {}
): Promise<RunCliResult> {
  return runCli(argv, {
    env: {
      BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
      BREW_API_KEY: KEY,
    },
    extraCommands: EXTRA,
    ...options,
  })
}

/** The JSON error envelope: the last stderr line (progress lines come first). */
function errorOf(result: RunCliResult): Record<string, unknown> {
  const line = result.stderr.trim().split('\n').at(-1) ?? ''
  return (JSON.parse(line) as { error: Record<string, unknown> }).error
}

function apiError(status: number, code: string, message: string): Response {
  return HttpResponse.json(
    { error: { code, type: 'invalid_request', message } },
    { status }
  )
}

/** A file in a fresh temp directory; returns its path. */
function tempFile(name: string, bytes: Uint8Array = PNG): string {
  const path = join(mkdtempSync(join(tmpdir(), 'brew-cli-upload-')), name)
  writeFileSync(path, bytes)
  return path
}

/** A sparse file of `size` bytes: cheap to create at 20 MB. */
function sparseFile(name: string, size: number): string {
  const path = tempFile(name, new Uint8Array())
  truncateSync(path, size)
  return path
}

describe('brand delete-image', () => {
  it('exits 4 with a confirmCommand when unconfirmed and non-interactive', async () => {
    // No handler: MSW fails the run if a request goes out.
    const result = await cli(['brand', 'delete-image', ASSET_ID])
    expect(result.code).toBe(4)
    const envelope = result.json as Record<string, unknown>
    expect(envelope.confirmationRequired).toBe(true)
    expect(envelope.command).toBe('brew-cli brand delete-image')
    expect(envelope.summary).toContain(ASSET_ID)
    expect(envelope.summary).toContain('stays hosted')
    expect(envelope.confirmCommand).toBe(
      `brew-cli brand delete-image ${ASSET_ID} --yes`
    )
  })

  it('DELETEs the one image with --yes and prints the answer verbatim', async () => {
    let path: string | undefined
    server.use(
      http.delete(`${API}/v1/brand/images/:assetId`, ({ request }) => {
        path = new URL(request.url).pathname
        return HttpResponse.json({ assetId: ASSET_ID, deleted: true })
      })
    )
    const result = await cli(['brand', 'delete-image', ASSET_ID, '--yes'])
    expect(result.code).toBe(0)
    expect(path).toBe(`/api/v1/brand/images/${ASSET_ID}`)
    expect(result.json).toEqual({ assetId: ASSET_ID, deleted: true })
  })

  it('says what it deleted in human mode', async () => {
    server.use(
      http.delete(`${API}/v1/brand/images/:assetId`, () =>
        HttpResponse.json({ assetId: ASSET_ID, deleted: true })
      )
    )
    const result = await cli(['brand', 'delete-image', ASSET_ID, '--yes'], {
      ttyOut: true,
    })
    expect(result.code).toBe(0)
    expect(result.stdout).toContain(
      `Deleted image ${ASSET_ID} from the brand library.`
    )
    expect(result.stdout).toContain('stays hosted at its URL')
  })

  it('reports an id not in the library as deleted: false and exits 0', async () => {
    server.use(
      http.delete(`${API}/v1/brand/images/:assetId`, () =>
        HttpResponse.json({ assetId: 'aaaaaaaa', deleted: false })
      )
    )
    const json = await cli(['brand', 'delete-image', 'aaaaaaaa', '--yes'])
    expect(json.code).toBe(0)
    expect(json.json).toEqual({ assetId: 'aaaaaaaa', deleted: false })

    const human = await cli(['brand', 'delete-image', 'aaaaaaaa', '--yes'], {
      ttyOut: true,
    })
    expect(human.code).toBe(0)
    expect(human.stdout).toContain(
      'Image aaaaaaaa is not in the brand library; nothing changed.'
    )
  })

  it("surfaces the API's 400 for a logo", async () => {
    server.use(
      http.delete(`${API}/v1/brand/images/:assetId`, () =>
        apiError(
          400,
          'INVALID_REQUEST',
          'Logos are managed on the Assets page in Brew.'
        )
      )
    )
    const result = await cli(['brand', 'delete-image', ASSET_ID, '--yes'])
    expect(result.code).toBe(1)
    expect(errorOf(result).code).toBe('INVALID_REQUEST')
  })

  it('asks y/N on a TTY and sends nothing on "n"', async () => {
    const result = await cli(['brand', 'delete-image', ASSET_ID], {
      ttyOut: true,
      ttyIn: true,
      promptAnswer: 'n',
    })
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Aborted')
  })
})

describe('content add-image', () => {
  it('adds an uploaded file by --upload-id and returns its assetId', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/content/add-image`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(ADDED)
      })
    )
    const result = await cli(['content', 'add-image', '--upload-id', UPLOAD_ID])
    expect(result.code).toBe(0)
    expect(body).toEqual({ uploadId: UPLOAD_ID })
    expect(result.json).toEqual(ADDED)
  })

  it('passes an imageUrls batch from --input through (202)', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/content/add-image`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          { accepted: 2, skipped: 0, runId: 'run_1' },
          { status: 202 }
        )
      })
    )
    const imageUrls = ['https://x.test/a.png', 'https://x.test/b.png']
    const result = await cli([
      'content',
      'add-image',
      '--input',
      JSON.stringify({ imageUrls }),
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({ imageUrls })
    expect(result.json).toEqual({ accepted: 2, skipped: 0, runId: 'run_1' })
  })

  it.each([
    [
      '--url and --upload-id',
      ['--url', 'https://x.test/a.png', '--upload-id', UPLOAD_ID],
    ],
    [
      '--upload-id and an imageUrls batch',
      [
        '--upload-id',
        UPLOAD_ID,
        '--input',
        '{"imageUrls":["https://x.test/a.png"]}',
      ],
    ],
    [
      '--url and an imageUrls batch',
      [
        '--url',
        'https://x.test/a.png',
        '--input',
        '{"imageUrls":["https://x.test/b.png"]}',
      ],
    ],
  ])('refuses %s before sending (exit 2)', async (_label, flags) => {
    const result = await cli(['content', 'add-image', ...flags])
    expect(result.code).toBe(2)
    const error = errorOf(result)
    expect(error.code).toBe('CLI_USAGE')
    expect(String(error.message)).toContain('exactly one')
  })

  it('requires an image (exit 2)', async () => {
    const result = await cli(['content', 'add-image'])
    expect(result.code).toBe(2)
    expect(String(errorOf(result).message)).toContain('--upload-id')
  })

  it("surfaces the API's 409 UPLOAD_IN_PROGRESS with its code", async () => {
    server.use(
      http.post(`${API}/v1/content/add-image`, () =>
        apiError(
          409,
          'UPLOAD_IN_PROGRESS',
          'Another call is converting this upload. Retry shortly.'
        )
      )
    )
    const result = await cli(['content', 'add-image', '--upload-id', UPLOAD_ID])
    expect(result.code).toBe(1)
    expect(errorOf(result).code).toBe('UPLOAD_IN_PROGRESS')
  })

  it('shows the added image and its assetId in human mode', async () => {
    server.use(
      http.post(`${API}/v1/content/add-image`, () => HttpResponse.json(ADDED))
    )
    const result = await cli(
      ['content', 'add-image', '--url', 'https://x.test/logo.png'],
      { ttyOut: true }
    )
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Added the image to the brand library.')
    expect(result.stdout).toContain(`assetId  ${ASSET_ID}`)
    expect(result.stdout).toContain(`url      ${ADDED.url}`)
    expect(result.stdout).toContain('size     800x600 (4:3)')
  })

  it('leaves the assetId line out against a deployment that predates it', async () => {
    const { assetId: _omitted, ...legacy } = ADDED
    server.use(
      http.post(`${API}/v1/content/add-image`, () => HttpResponse.json(legacy))
    )
    const result = await cli(
      ['content', 'add-image', '--url', 'https://x.test/logo.png'],
      { ttyOut: true }
    )
    expect(result.code).toBe(0)
    expect(result.stdout).toContain(`url      ${ADDED.url}`)
    expect(result.stdout).not.toContain('assetId')
  })

  it("renders a batch import's 202 in human mode", async () => {
    server.use(
      http.post(`${API}/v1/content/add-image`, () =>
        HttpResponse.json(
          { accepted: 2, skipped: 1, runId: 'run_1' },
          { status: 202 }
        )
      )
    )
    const result = await cli(
      [
        'content',
        'add-image',
        '--input',
        '{"imageUrls":["https://x.test/a.png","https://x.test/b.png","https://x.test/a.png"]}',
      ],
      { ttyOut: true }
    )
    expect(result.code).toBe(0)
    expect(result.stdout).toContain(
      'Accepted 2 image(s) for a background import; skipped 1. Run: run_1'
    )
  })

  it('is free: no credits note in its help', async () => {
    expect(contentAddImageCommand.isCredited).not.toBe(true)
    const result = await cli(['content', 'add-image', '--help'])
    expect(result.code).toBe(0)
    expect(result.stdout).not.toContain('consumes Brew credits')
    expect(result.stdout).toContain('--upload-id <id>')
  })
})

describe('content create-image-upload', () => {
  it('opens an upload, reading the type from --file-name', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/content/image-uploads`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(TICKET, { status: 201 })
      })
    )
    const result = await cli([
      'content',
      'create-image-upload',
      '--file-name',
      'logo.PNG',
      '--size',
      '1234',
    ])
    expect(result.code).toBe(0)
    expect(body).toEqual({
      fileName: 'logo.PNG',
      contentType: 'image/png',
      size: 1234,
    })
    expect(result.json).toEqual(TICKET)
  })

  it('sends --content-type as given, whatever the name says', async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.post(`${API}/v1/content/image-uploads`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(TICKET, { status: 201 })
      })
    )
    const result = await cli([
      'content',
      'create-image-upload',
      '--file-name',
      'hero',
      '--content-type',
      'image/webp',
      '--size',
      '99',
    ])
    expect(result.code).toBe(0)
    expect(body?.contentType).toBe('image/webp')
  })

  it('refuses a name whose type it cannot tell, before sending (exit 2)', async () => {
    const result = await cli([
      'content',
      'create-image-upload',
      '--file-name',
      'logo.bmp',
      '--size',
      '10',
    ])
    expect(result.code).toBe(2)
    expect(String(errorOf(result).message)).toContain('--content-type')
  })

  it.each([
    ['--file-name', ['--size', '10']],
    ['--size', ['--file-name', 'logo.png']],
  ])('requires %s (exit 2)', async (flag, flags) => {
    const result = await cli(['content', 'create-image-upload', ...flags])
    expect(result.code).toBe(2)
    expect(String(errorOf(result).message)).toContain(flag)
  })

  it('prints the two steps that finish the upload in human mode', async () => {
    server.use(
      http.post(`${API}/v1/content/image-uploads`, () =>
        HttpResponse.json(TICKET, { status: 201 })
      )
    )
    const result = await cli(
      [
        'content',
        'create-image-upload',
        '--file-name',
        'logo.png',
        '--size',
        '12',
      ],
      { ttyOut: true }
    )
    expect(result.code).toBe(0)
    expect(result.stdout).toContain(
      `Upload ${UPLOAD_ID} is open until ${EXPIRES_AT}`
    )
    expect(result.stdout).toContain(
      `curl -X POST --data-binary @logo.png '${UPLOAD_URL}'`
    )
    expect(result.stdout).toContain(
      `brew-cli content add-image --upload-id ${UPLOAD_ID}`
    )
  })
})

describe('content upload-image', () => {
  /** The three requests of one upload, in the order they arrived. */
  function uploadHandlers(
    seen: Array<string>,
    captured: {
      create?: unknown
      bytes?: Uint8Array
      bytesHeaders?: Headers
      bytesQuery?: URLSearchParams
      add?: unknown
    } = {}
  ) {
    return [
      http.post(`${API}/v1/content/image-uploads`, async ({ request }) => {
        seen.push('create')
        captured.create = await request.json()
        return HttpResponse.json(TICKET, { status: 201 })
      }),
      http.post(UPLOAD_ENDPOINT, async ({ request }) => {
        seen.push('bytes')
        captured.bytes = new Uint8Array(await request.arrayBuffer())
        captured.bytesHeaders = request.headers
        captured.bytesQuery = new URL(request.url).searchParams
        return HttpResponse.json({
          uploadId: UPLOAD_ID,
          status: 'uploaded',
          size: PNG.length,
          expiresAt: EXPIRES_AT,
        })
      }),
      http.post(`${API}/v1/content/add-image`, async ({ request }) => {
        seen.push('add')
        captured.add = await request.json()
        return HttpResponse.json(ADDED)
      }),
    ]
  }

  it('opens an upload, sends the bytes without the API key, then adds the image', async () => {
    const seen: Array<string> = []
    const captured: Parameters<typeof uploadHandlers>[1] = {}
    server.use(...uploadHandlers(seen, captured))
    const result = await cli([
      'content',
      'upload-image',
      tempFile('logo.png'),
      '--brand',
      'brand_1',
    ])
    expect(result.code).toBe(0)
    expect(seen).toEqual(['create', 'bytes', 'add'])
    expect(captured.create).toEqual({
      fileName: 'logo.png',
      contentType: 'image/png',
      size: PNG.length,
    })
    expect(captured.bytes).toEqual(PNG)
    expect(captured.bytesQuery?.get('token')).toBe(UPLOAD_TOKEN)
    expect(captured.bytesHeaders?.get('content-type')).toBe('image/png')
    expect(captured.bytesHeaders?.get('authorization')).toBeNull()
    expect(captured.bytesHeaders?.get('x-brand-id')).toBeNull()
    expect(captured.add).toEqual({ uploadId: UPLOAD_ID })
    expect(result.json).toEqual(ADDED)
  })

  it('names the upload with --file-name and takes --content-type over the extension', async () => {
    const seen: Array<string> = []
    const captured: Parameters<typeof uploadHandlers>[1] = {}
    server.use(...uploadHandlers(seen, captured))
    const result = await cli([
      'content',
      'upload-image',
      tempFile('export.bin'),
      '--file-name',
      'hero',
      '--content-type',
      'image/png',
    ])
    expect(result.code).toBe(0)
    expect(captured.create).toEqual({
      fileName: 'hero',
      contentType: 'image/png',
      size: PNG.length,
    })
  })

  it("falls back to the path's extension when --file-name has none", async () => {
    const seen: Array<string> = []
    const captured: Parameters<typeof uploadHandlers>[1] = {}
    server.use(...uploadHandlers(seen, captured))
    const result = await cli([
      'content',
      'upload-image',
      tempFile('photo.jpeg'),
      '--file-name',
      'Team photo',
    ])
    expect(result.code).toBe(0)
    expect(captured.create).toEqual({
      fileName: 'Team photo',
      contentType: 'image/jpeg',
      size: PNG.length,
    })
  })

  it('exits 2 for a file that does not exist, before any request', async () => {
    const missing = join(tmpdir(), 'brew-cli-no-such-dir', 'logo.png')
    const result = await cli(['content', 'upload-image', missing])
    expect(result.code).toBe(2)
    const error = errorOf(result)
    expect(error.code).toBe('CLI_USAGE')
    expect(String(error.message)).toContain(`Cannot read "${missing}"`)
  })

  it('exits 2 for a directory', async () => {
    const dir = join(
      mkdtempSync(join(tmpdir(), 'brew-cli-upload-')),
      'logo.png'
    )
    mkdirSync(dir)
    const result = await cli(['content', 'upload-image', dir])
    expect(result.code).toBe(2)
    expect(String(errorOf(result).message)).toContain('is not a file')
  })

  it('exits 2 for an extension it cannot read, naming --content-type', async () => {
    const result = await cli(['content', 'upload-image', tempFile('logo.bmp')])
    expect(result.code).toBe(2)
    const message = String(errorOf(result).message)
    expect(message).toContain('logo.bmp')
    expect(message).toContain('--content-type')
  })

  it('exits 2 for a --content-type the API does not take', async () => {
    const result = await cli([
      'content',
      'upload-image',
      tempFile('logo.png'),
      '--content-type',
      'image/bmp',
    ])
    expect(result.code).toBe(2)
    expect(String(errorOf(result).message)).toContain('image/svg+xml')
  })

  it('exits 2 for an empty file', async () => {
    const result = await cli([
      'content',
      'upload-image',
      tempFile('logo.png', new Uint8Array()),
    ])
    expect(result.code).toBe(2)
    expect(String(errorOf(result).message)).toContain('is empty')
  })

  it.each([
    ['big.png', 20_000_001, '20,000,000'],
    ['big.svg', 2_097_153, '2,097,152'],
  ])(
    'exits 2 for %s over its cap, before reading it',
    async (name, size, cap) => {
      const result = await cli([
        'content',
        'upload-image',
        sparseFile(name, size),
      ])
      expect(result.code).toBe(2)
      expect(String(errorOf(result).message)).toContain(cap)
    }
  )

  it("surfaces the upload URL's 413 without printing its token", async () => {
    const seen: Array<string> = []
    server.use(
      http.post(`${API}/v1/content/image-uploads`, () => {
        seen.push('create')
        return HttpResponse.json(TICKET, { status: 201 })
      }),
      http.post(UPLOAD_ENDPOINT, () => {
        seen.push('bytes')
        return apiError(
          413,
          'PAYLOAD_TOO_LARGE',
          'The file is larger than maxBytes.'
        )
      })
    )
    const result = await cli(['content', 'upload-image', tempFile('logo.png')])
    expect(result.code).toBe(1)
    expect(seen).toEqual(['create', 'bytes'])
    expect(errorOf(result).code).toBe('PAYLOAD_TOO_LARGE')
    expect(`${result.stdout}${result.stderr}`).not.toContain(UPLOAD_TOKEN)
  })

  it('reports a stalled byte upload as CLI_TIMEOUT without printing its token', async () => {
    server.use(
      http.post(`${API}/v1/content/image-uploads`, () =>
        HttpResponse.json(TICKET, { status: 201 })
      ),
      http.post(UPLOAD_ENDPOINT, () => new Promise<Response>(() => undefined))
    )
    const result = await cli([
      'content',
      'upload-image',
      tempFile('logo.png'),
      '--timeout',
      '300ms',
      '--max-retries',
      '0',
    ])
    expect(result.code).toBe(1)
    expect(errorOf(result).code).toBe('CLI_TIMEOUT')
    expect(`${result.stdout}${result.stderr}`).not.toContain(UPLOAD_TOKEN)
  })

  it("surfaces add-image's 409 UPLOAD_NOT_RECEIVED", async () => {
    server.use(
      http.post(`${API}/v1/content/image-uploads`, () =>
        HttpResponse.json(TICKET, { status: 201 })
      ),
      http.post(UPLOAD_ENDPOINT, () =>
        HttpResponse.json({ uploadId: UPLOAD_ID, status: 'uploaded' })
      ),
      http.post(`${API}/v1/content/add-image`, () =>
        apiError(409, 'UPLOAD_NOT_RECEIVED', 'The bytes were never sent.')
      )
    )
    const result = await cli(['content', 'upload-image', tempFile('logo.png')])
    expect(result.code).toBe(1)
    expect(errorOf(result).code).toBe('UPLOAD_NOT_RECEIVED')
  })

  it('never offers to replay its last request alone after an unknown outcome', async () => {
    server.use(
      http.post(`${API}/v1/content/image-uploads`, () =>
        HttpResponse.json(TICKET, { status: 201 })
      ),
      http.post(UPLOAD_ENDPOINT, () =>
        HttpResponse.json({ uploadId: UPLOAD_ID, status: 'uploaded' })
      ),
      http.post(`${API}/v1/content/add-image`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'INTERNAL_ERROR',
              type: 'internal_error',
              message: 'Something went wrong.',
            },
          },
          { status: 500 }
        )
      )
    )
    const result = await cli([
      'content',
      'upload-image',
      tempFile('logo.png'),
      '--max-retries',
      '0',
    ])
    expect(result.code).toBe(1)
    const error = errorOf(result)
    expect(error.code).toBe('INTERNAL_ERROR')
    // Re-running `upload-image` with add-image's key would open a NEW
    // upload and send a different body under that key.
    expect(error.retryCommand).toBeUndefined()
    expect(error.idempotencyKey).toBeUndefined()
    expect(String(error.suggestion)).toContain('does not replay')
  })

  it('shows the added image and its assetId in human mode', async () => {
    server.use(...uploadHandlers([]))
    const result = await cli(
      ['content', 'upload-image', tempFile('logo.png')],
      {
        ttyOut: true,
      }
    )
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Added logo.png to the brand library.')
    expect(result.stdout).toContain(`assetId  ${ASSET_ID}`)
    expect(result.stderr).toContain('Uploading logo.png (12 bytes)')
  })

  it('prints the answer verbatim with --json on a TTY', async () => {
    server.use(...uploadHandlers([]))
    const result = await cli(
      ['content', 'upload-image', tempFile('logo.png'), '--json'],
      { ttyOut: true }
    )
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual(ADDED)
  })
})
