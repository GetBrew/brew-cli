import {
  ADD_IMAGE_DEFAULT_TIMEOUT_MS,
  type ContentAddImageRequest,
} from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  requestOptions,
} from '../../lib/input'
import { renderAddedImage } from './image-library'

/** The request body's three branches; the API takes exactly one. */
const IMAGE_SOURCES = ['imageUrl', 'imageUrls', 'uploadId'] as const

export const contentAddImageCommand = defineCommand({
  path: ['content', 'add-image'],
  summary:
    'Add an image to the brand library from a public URL, a batch of URLs, or an upload (free); returns its assetId',
  sdkMethod: 'content.addImage',
  route: { method: 'POST', path: '/v1/content/add-image' },
  commandClass: 'write',
  defaultTimeoutMs: ADD_IMAGE_DEFAULT_TIMEOUT_MS,
  flags: [
    { flag: '--url <url>', summary: 'One public image URL (imageUrl)' },
    {
      flag: '--upload-id <id>',
      summary:
        'An upload whose bytes were sent (uploadId, from `content create-image-upload`); a repeat returns the same image for 24 hours',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli content add-image --url https://cdn.example.com/logo.png',
    'brew-cli content add-image --upload-id imgup_V1StGXR8_Z5jdHi6B-myT',
    `brew-cli content add-image --input '{"imageUrls":["https://cdn.example.com/a.png","https://cdn.example.com/b.png"]}'`,
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      imageUrl: flagString(flags.url),
      uploadId: flagString(flags.uploadId),
    })
    const given = IMAGE_SOURCES.filter(
      (key) => input[key] !== undefined && input[key] !== ''
    )
    if (given.length === 0) {
      throw new CliUsageError(
        'An image is required: --url, --upload-id, or imageUrls in --input.'
      )
    }
    if (given.length > 1) {
      throw new CliUsageError(
        `Pass exactly one of --url (imageUrl), --upload-id (uploadId) or imageUrls (--input); got ${given.join(' and ')}.`
      )
    }
    const result = await ctx
      .client()
      .content.addImage(
        asSdkInput<ContentAddImageRequest>(input),
        requestOptions(flags)
      )
    return { data: result, human: renderAddedImage(result) }
  },
})
