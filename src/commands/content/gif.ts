import type { ContentGifRequest } from '@brew.new/sdk'
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

export const contentGifCommand = defineCommand({
  path: ['content', 'gif'],
  summary: 'Create an animated GIF from a prompt, image, or video',
  sdkMethod: 'content.gif',
  route: { method: 'POST', path: '/v1/content/gif' },
  commandClass: 'write',
  isCredited: true,
  flags: [
    { flag: '--from <source>', summary: 'prompt | image | video' },
    { flag: '--prompt <text>', summary: 'What to animate' },
    { flag: '--image-url <url>', summary: 'Source image (from: image)' },
    { flag: '--video-url <url>', summary: 'Source video (from: video)' },
    { flag: '--duration <seconds>', summary: 'Clip duration in seconds' },
    { flag: '--fps <n>', summary: 'Frames per second' },
    {
      flag: '--aspect-ratio <ratio>',
      summary: 'e.g. 16:9, 1:1, 9:16',
    },
    { flag: '--loop <bool>', summary: 'Loop the GIF: true | false' },
    { flag: '--width <n>', summary: 'Output width (from: video)' },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli content gif --prompt "steam rising from a coffee cup"',
    'brew-cli content gif --image-url https://cdn.example.com/mug.png --prompt "gentle zoom"',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      from: flagString(flags.from),
      prompt: flagString(flags.prompt),
      imageUrl: flagString(flags.imageUrl),
      videoUrl: flagString(flags.videoUrl),
      duration: flagNumber(flags.duration, '--duration'),
      fps: flagInt(flags.fps, '--fps'),
      aspectRatio: flagString(flags.aspectRatio),
      loop: parseBool(flags.loop),
      width: flagInt(flags.width, '--width'),
    })
    // The API requires the `from` discriminator; infer it from the source
    // that was provided so the obvious invocations just work.
    if (input.from === undefined) {
      if (typeof input.videoUrl === 'string') {
        input.from = 'video'
      } else if (typeof input.imageUrl === 'string') {
        input.from = 'image'
      } else if (typeof input.prompt === 'string') {
        input.from = 'prompt'
      }
    }
    if (input.from === undefined) {
      throw new CliUsageError(
        'Pass --prompt, --image-url, or --video-url (or --input).'
      )
    }
    const result = await ctx
      .client()
      .content.gif(asSdkInput<ContentGifRequest>(input), requestOptions(flags))
    return { data: result }
  },
})

function parseBool(value: unknown): boolean | undefined {
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  if (value === undefined) {
    return
  }
  throw new CliUsageError('--loop must be true or false')
}

function flagNumber(value: unknown, flagName: string): number | undefined {
  if (value === undefined) {
    return
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new CliUsageError(`${flagName} must be a positive number`)
  }
  return parsed
}
