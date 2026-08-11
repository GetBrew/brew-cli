import type { ContentTransformRequest } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagInt,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  requestOptions,
} from '../../lib/input'

export const contentTransformCommand = defineCommand({
  path: ['content', 'transform'],
  summary: 'Optimize or resize a hosted image',
  sdkMethod: 'content.transform',
  route: { method: 'POST', path: '/v1/content/transform' },
  commandClass: 'write',
  isCredited: true,
  flags: [
    { flag: '--url <url>', summary: 'Image URL to transform' },
    {
      flag: '--operation <op>',
      summary: 'optimize | resize (default: optimize)',
    },
    { flag: '--width <n>', summary: 'Target width (resize)' },
    { flag: '--height <n>', summary: 'Target height (resize)' },
    { flag: '--prompt <text>', summary: 'Guidance for the resize' },
    { flag: '--resolution <res>', summary: '1K | 2K | 4K (resize)' },
    {
      flag: '--output-format <format>',
      summary: 'png | jpeg | webp (resize)',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli content transform --url https://cdn.example.com/hero.png',
    'brew-cli content transform --url https://cdn.example.com/hero.png --operation resize --width 1200 --height 630',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      operation: flagString(flags.operation),
      imageUrl: flagString(flags.url),
      width: flagInt(flags.width, '--width'),
      height: flagInt(flags.height, '--height'),
      prompt: flagString(flags.prompt),
      resolution: flagString(flags.resolution),
      outputFormat: flagString(flags.outputFormat),
    })
    if (typeof input.imageUrl !== 'string' || input.imageUrl === '') {
      throw new CliUsageError('An image URL is required (--url or --input).')
    }
    // The API requires the `operation` discriminator. Resize knobs imply
    // resize; the bare-URL case defaults to optimize (which accepts no
    // other fields on the strict schema).
    if (input.operation === undefined) {
      const hasResizeKnobs = [
        input.width,
        input.height,
        input.prompt,
        input.resolution,
        input.outputFormat,
      ].some((value) => value !== undefined)
      input.operation = hasResizeKnobs ? 'resize' : 'optimize'
    }
    const result = await ctx
      .client()
      .content.transform(
        asSdkInput<ContentTransformRequest>(input),
        requestOptions(flags)
      )
    return { data: result }
  },
})
