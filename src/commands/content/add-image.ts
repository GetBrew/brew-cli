import type { ContentAddImageRequest } from '@brew.new/sdk'
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

export const contentAddImageCommand = defineCommand({
  path: ['content', 'add-image'],
  summary: 'Mirror an external image onto Brew-hosted storage',
  sdkMethod: 'content.addImage',
  route: { method: 'POST', path: '/v1/content/add-image' },
  commandClass: 'write',
  isCredited: true,
  flags: [
    { flag: '--url <url>', summary: 'Image URL to mirror' },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli content add-image --url https://cdn.example.com/logo.png',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      imageUrl: flagString(flags.url),
    })
    if (typeof input.imageUrl !== 'string' || input.imageUrl === '') {
      throw new CliUsageError('An image URL is required (--url or --input).')
    }
    const result = await ctx
      .client()
      .content.addImage(
        asSdkInput<ContentAddImageRequest>(input),
        requestOptions(flags)
      )
    return { data: result }
  },
})
