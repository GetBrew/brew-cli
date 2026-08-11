import type { ContentHtmlToPngRequest } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagInt,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  readTextFlag,
  requestOptions,
} from '../../lib/input'

export const contentHtmlToPngCommand = defineCommand({
  path: ['content', 'html-to-png'],
  summary: 'Render HTML to a hosted PNG',
  sdkMethod: 'content.htmlToPng',
  route: { method: 'POST', path: '/v1/content/html-to-png' },
  commandClass: 'write',
  isCredited: true,
  flags: [
    {
      flag: '--file <path>',
      summary: 'HTML file to render, or - for stdin',
    },
    { flag: '--width <n>', summary: 'Viewport width in pixels' },
    { flag: '--max-height <n>', summary: 'Clip the render at this height' },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli content html-to-png --file email.html --width 600',
    'cat snippet.html | brew-cli content html-to-png --file -',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const html = await readTextFlag(ctx, flags.file, '--file')
    const input = mergeInput(base, {
      html,
      width: flagInt(flags.width, '--width'),
      maxHeight: flagInt(flags.maxHeight, '--max-height'),
    })
    if (typeof input.html !== 'string' || input.html === '') {
      throw new CliUsageError('HTML is required (--file <path|-> or --input).')
    }
    const result = await ctx
      .client()
      .content.htmlToPng(
        asSdkInput<ContentHtmlToPngRequest>(input),
        requestOptions(flags)
      )
    return { data: result }
  },
})
