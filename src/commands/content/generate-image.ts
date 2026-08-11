import type { ContentGenerateImageRequest } from '@brew.new/sdk'
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

export const contentGenerateImageCommand = defineCommand({
  path: ['content', 'generate-image'],
  summary: 'Generate or edit an image from a prompt',
  sdkMethod: 'content.generateImage',
  route: { method: 'POST', path: '/v1/content/generate-image' },
  commandClass: 'write',
  isCredited: true,
  flags: [
    { flag: '--prompt <text>', summary: 'What to generate' },
    { flag: '--mode <mode>', summary: 'text-to-image | image-editing' },
    {
      flag: '--aspect-ratio <ratio>',
      summary: 'e.g. 16:9, 3:2, 1:1, 9:16',
    },
    { flag: '--model <model>', summary: 'Image model override' },
    { flag: '--image1 <url>', summary: 'Source image for image-editing' },
    {
      flag: '--image2 <url>',
      summary: 'Second source image for image-editing',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli content generate-image --prompt "hero shot of a ceramic mug" --aspect-ratio 16:9',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      prompt: flagString(flags.prompt),
      mode: flagString(flags.mode),
      aspectRatio: flagString(flags.aspectRatio),
      model: flagString(flags.model),
      image1: flagString(flags.image1),
      image2: flagString(flags.image2),
    })
    if (typeof input.prompt !== 'string' || input.prompt === '') {
      throw new CliUsageError('A prompt is required (--prompt or --input).')
    }
    const result = await ctx
      .client()
      .content.generateImage(
        asSdkInput<ContentGenerateImageRequest>(input),
        requestOptions(flags)
      )
    return { data: result }
  },
})
