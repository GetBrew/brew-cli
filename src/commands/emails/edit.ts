import type { EditEmailInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  toStringArray,
} from '../../lib/input'
import { progress } from '../../lib/output'

export const emailsEditCommand = defineCommand({
  path: ['emails', 'edit'],
  summary: 'AI-edit an email design (creates a new latest version)',
  sdkMethod: 'emails.edit',
  route: { method: 'PATCH', path: '/v1/emails/{emailId}' },
  commandClass: 'write',
  isCredited: true,
  args: [{ name: 'emailId', summary: 'Design id to edit', isRequired: true }],
  flags: [
    { flag: '--prompt <text>', summary: 'The edit instruction' },
    {
      flag: '--email-version-id <id>',
      summary: 'Edit from a specific version (default: latest)',
    },
    {
      flag: '--content-urls <urls...>',
      summary: 'Page URL(s) to pull copy and imagery from, repeatable',
    },
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli emails edit eml_2SmZOWV3ZQ7W5x6g3m4p --prompt "Tighten the hero copy"',
  ],
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      prompt: flagString(flags.prompt),
      emailVersionId: flagString(flags.emailVersionId),
      contentUrls: toStringArray(flags.contentUrls),
    })
    if (typeof input.prompt !== 'string' || input.prompt === '') {
      throw new CliUsageError(
        '--prompt is required (or provide it via --input).'
      )
    }
    progress(ctx, 'Editing email… (typically 30-90s)')
    const result = await ctx
      .client()
      .emails.edit(
        asSdkInput<EditEmailInput>({ emailId: args.emailId ?? '', ...input }),
        { timeoutMs: 240_000 }
      )
    return { data: result }
  },
})
