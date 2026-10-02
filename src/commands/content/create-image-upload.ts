import type {
  ContentImageUploadCreateRequest,
  ContentImageUploadCreateResponse,
} from '@brew.new/sdk'
import { shellQuote } from '../../lib/confirm'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagInt,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'
import {
  CONTENT_TYPE_FLAG,
  contentTypeOfName,
  unknownTypeError,
} from './image-library'

/**
 * The first step of the two-step upload, for bytes this CLI does not send
 * itself (another machine, a pipeline): `content upload-image <file>` runs
 * all three steps in one call. No `--idempotency-key`: the route never
 * replays its answer (it carries a bearer URL), so a retry opens a second
 * upload, which expires unused.
 */
export const contentCreateImageUploadCommand = defineCommand({
  path: ['content', 'create-image-upload'],
  summary:
    'Open a single-use upload for one local image file (free): POST its bytes to uploadUrl, then `content add-image --upload-id`',
  sdkMethod: 'content.createImageUpload',
  route: { method: 'POST', path: '/v1/content/image-uploads' },
  commandClass: 'write',
  flags: [
    {
      flag: '--file-name <name>',
      summary: 'The file name, e.g. logo.png (names the converted file)',
    },
    {
      flag: '--size <bytes>',
      summary: 'The file size in bytes: at most 20,000,000 (2,097,152 for SVG)',
    },
    CONTENT_TYPE_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli content create-image-upload --file-name logo.png --size 48213',
    'brew-cli content create-image-upload --file-name hero --content-type image/webp --size 1048576',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      fileName: flagString(flags.fileName),
      contentType: flagString(flags.contentType),
      size: flagInt(flags.size, '--size'),
    })
    const { fileName } = input
    if (typeof fileName !== 'string' || fileName === '') {
      throw new CliUsageError(
        'A file name is required (--file-name or fileName in --input).'
      )
    }
    if (input.size === undefined) {
      throw new CliUsageError(
        'The file size is required (--size or size in --input).'
      )
    }
    // An explicit type goes to the API as given (it validates it); a
    // missing one is read from the name, as `content upload-image` does.
    if (input.contentType === undefined) {
      const inferred = contentTypeOfName(fileName)
      if (inferred === undefined) {
        throw unknownTypeError(fileName)
      }
      input.contentType = inferred
    }
    const result = await ctx
      .client()
      .content.createImageUpload(
        asSdkInput<ContentImageUploadCreateRequest>(input)
      )
    return { data: result, human: renderTicket(result, fileName) }
  },
})

function renderTicket(
  ticket: ContentImageUploadCreateResponse,
  fileName: string
): string {
  return [
    `Upload ${ticket.uploadId} is open until ${ticket.expiresAt} (at most ${ticket.maxBytes} bytes).`,
    "1. POST the file's raw bytes to uploadUrl, with no API key (the URL is its own credential: keep it private):",
    `   curl -X POST --data-binary ${shellQuote(`@${fileName}`)} ${shellQuote(ticket.uploadUrl)}`,
    '2. Add it to the brand library within 15 minutes of the bytes landing:',
    `   brew-cli content add-image --upload-id ${ticket.uploadId}`,
  ].join('\n')
}
