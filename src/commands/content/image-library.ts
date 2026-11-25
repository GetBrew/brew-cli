import type {
  ContentAddImageBatchResponse,
  ContentAddImageResponse,
  ContentImageUploadContentType,
} from '@brew.new/sdk'
import { CliUsageError } from '../../lib/errors'

const MAX_UPLOAD_BYTES: Readonly<
  Record<ContentImageUploadContentType, number>
> = {
  'image/png': 20_000_000,
  'image/jpeg': 20_000_000,
  'image/gif': 20_000_000,
  'image/webp': 20_000_000,
  'image/avif': 20_000_000,
  'image/tiff': 20_000_000,
  'image/svg+xml': 2_097_152,
}

const UPLOAD_CONTENT_TYPES = Object.keys(MAX_UPLOAD_BYTES).join(', ')

const CONTENT_TYPE_BY_EXTENSION: Readonly<
  Record<string, ContentImageUploadContentType>
> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
}

export const CONTENT_TYPE_FLAG = {
  flag: '--content-type <type>',
  summary: `Image type, else read from the file name's extension: ${UPLOAD_CONTENT_TYPES}`,
} as const

export function isUploadContentType(
  value: string
): value is ContentImageUploadContentType {
  return Object.hasOwn(MAX_UPLOAD_BYTES, value)
}

export function contentTypeOfName(
  name: string
): ContentImageUploadContentType | undefined {
  const extension = /\.([^./\\]+)$/.exec(name)?.[1]?.toLowerCase()
  return extension === undefined
    ? undefined
    : CONTENT_TYPE_BY_EXTENSION[extension]
}

export function unknownTypeError(name: string): CliUsageError {
  return new CliUsageError(
    `Cannot tell the image type of "${name}" from its extension. Pass --content-type (${UPLOAD_CONTENT_TYPES}), or name the file .png, .jpg, .jpeg, .gif, .webp, .avif, .tif, .tiff or .svg.`
  )
}

export function checkedContentType(
  value: string
): ContentImageUploadContentType {
  if (!isUploadContentType(value)) {
    throw new CliUsageError(
      `--content-type must be one of ${UPLOAD_CONTENT_TYPES}; got "${value}".`
    )
  }
  return value
}

const BYTES = new Intl.NumberFormat('en-US')

export function assertUploadSize(input: {
  readonly label: string
  readonly size: number
  readonly contentType: ContentImageUploadContentType
}): void {
  const max = MAX_UPLOAD_BYTES[input.contentType]
  if (input.size === 0) {
    throw new CliUsageError(`${input.label} is empty.`)
  }
  if (input.size > max) {
    throw new CliUsageError(
      `${input.label} is ${BYTES.format(input.size)} bytes; an ${input.contentType} upload takes at most ${BYTES.format(max)}.`
    )
  }
}

export function renderAddedImage(
  answer: ContentAddImageResponse | ContentAddImageBatchResponse,
  name?: string
): string {
  if ('accepted' in answer) {
    return `Accepted ${answer.accepted} image(s) for a background import; skipped ${answer.skipped}.${
      answer.runId === undefined ? '' : ` Run: ${answer.runId}`
    }`
  }
  return [
    `Added ${name ?? 'the image'} to the brand library.`,
    ...(answer.assetId === undefined ? [] : [`assetId  ${answer.assetId}`]),
    `url      ${answer.url}`,
    `size     ${answer.width}x${answer.height} (${answer.aspectRatio})`,
  ].join('\n')
}
