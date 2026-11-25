import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import { flagString } from '../../lib/input'
import { progress } from '../../lib/output'
import {
  assertUploadSize,
  CONTENT_TYPE_FLAG,
  checkedContentType,
  contentTypeOfName,
  renderAddedImage,
  unknownTypeError,
} from './image-library'

export const contentUploadImageCommand = defineCommand({
  path: ['content', 'upload-image'],
  summary:
    'Upload a local image file (PNG, JPEG, GIF, WebP, AVIF, TIFF, SVG; up to 20 MB, SVG 2 MB) into the brand library (free); returns its assetId',
  sdkMethod: 'content.uploadImage',
  commandClass: 'write',
  args: [
    {
      name: 'file',
      summary: 'Path to the image file',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--file-name <name>',
      summary: "The name Brew stores it under (default: the path's file name)",
    },
    CONTENT_TYPE_FLAG,
  ],
  examples: [
    'brew-cli content upload-image ./logo.png',
    'brew-cli content upload-image ./export.bin --file-name hero.webp --content-type image/webp',
  ],
  run: async ({ ctx, args, flags }) => {
    const path = args.file ?? ''
    const size = await fileSize(path)
    const fileName = flagString(flags.fileName) ?? basename(path)
    const explicitType = flagString(flags.contentType)
    const contentType =
      explicitType === undefined
        ? (contentTypeOfName(fileName) ?? contentTypeOfName(path))
        : checkedContentType(explicitType)
    if (contentType === undefined) {
      throw unknownTypeError(fileName)
    }
    assertUploadSize({ label: `"${path}"`, size, contentType })
    const bytes = await readBytes(path)
    progress(ctx, `Uploading ${fileName} (${bytes.byteLength} bytes)…`)
    const result = await ctx
      .client()
      .content.uploadImage({ file: bytes, fileName, contentType })
    return { data: result, human: renderAddedImage(result, fileName) }
  },
})

async function fileSize(path: string): Promise<number> {
  let stats: Awaited<ReturnType<typeof stat>>
  try {
    stats = await stat(path)
  } catch (error) {
    throw unreadable(path, error)
  }
  if (!stats.isFile()) {
    throw new CliUsageError(`"${path}" is not a file.`)
  }
  return stats.size
}

async function readBytes(path: string): Promise<Uint8Array> {
  try {
    return await readFile(path)
  } catch (error) {
    throw unreadable(path, error)
  }
}

function unreadable(path: string, error: unknown): CliUsageError {
  const code = (error as { code?: unknown }).code
  const reason =
    code === 'ENOENT'
      ? 'no such file'
      : code === 'EACCES'
        ? 'permission denied'
        : typeof code === 'string'
          ? code
          : 'unreadable'
  return new CliUsageError(`Cannot read "${path}": ${reason}.`)
}
