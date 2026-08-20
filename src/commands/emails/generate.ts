import type { GenerateEmailInput } from '@brew.new/sdk'
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
  toStringArray,
} from '../../lib/input'
import { progress } from '../../lib/output'

export const emailsGenerateCommand = defineCommand({
  path: ['emails', 'generate'],
  summary: 'Generate a new on-brand email design from a prompt',
  sdkMethod: 'emails.generate',
  route: { method: 'POST', path: '/v1/emails' },
  commandClass: 'write',
  isCredited: true,
  flags: [
    { flag: '--prompt <text>', summary: 'What the email should be' },
    {
      flag: '--reference-email-id <emailId>',
      summary: 'Existing design or template to base the layout on',
    },
    {
      flag: '--content-urls <urls...>',
      summary: 'Page URL(s) to pull copy and imagery from, repeatable',
    },
    {
      flag: '--group-id <groupId>',
      summary: 'Destination group id; omit or use ungrouped for Ungrouped',
    },
    {
      flag: '--subject-line <text>',
      summary: "The design's default inbox subject line",
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli emails generate --prompt "Product-launch email for the fall sale"',
    'brew-cli emails generate --prompt "Welcome email" --group-id grp_welcome',
    'brew-cli emails generate --prompt "Welcome email" --subject-line "Welcome to Brew"',
    'brew-cli emails generate --prompt "Welcome email" --content-urls https://example.com/pricing',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      prompt: flagString(flags.prompt),
      referenceEmailId: flagString(flags.referenceEmailId),
      contentUrls: toStringArray(flags.contentUrls),
      groupId: flagString(flags.groupId),
      subjectLine: flagString(flags.subjectLine),
    })
    if (typeof input.prompt !== 'string' || input.prompt === '') {
      throw new CliUsageError(
        '--prompt is required (or provide it via --input).'
      )
    }
    progress(ctx, 'Generating email… (typically 30-90s)')
    const result = await ctx
      .client()
      .emails.generate(asSdkInput<GenerateEmailInput>(input), {
        timeoutMs: 240_000,
        ...(requestOptions(flags) ?? {}),
      })
    return { data: result }
  },
})
