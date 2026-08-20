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
  summary:
    'AI-edit an email design, and/or set its subject line (subject-only is free)',
  sdkMethod: 'emails.edit',
  route: { method: 'PATCH', path: '/v1/emails/{emailId}' },
  commandClass: 'write',
  isCredited: true,
  args: [{ name: 'emailId', summary: 'Design id to edit', isRequired: true }],
  flags: [
    { flag: '--prompt <text>', summary: 'The edit instruction' },
    {
      flag: '--email-version-id <id>',
      summary: 'Edit from a specific version (default: latest); needs --prompt',
    },
    {
      flag: '--content-urls <urls...>',
      summary: 'Page URL(s) to pull copy and imagery from, repeatable',
    },
    {
      flag: '--subject-line <text>',
      summary:
        "The design's default inbox subject line; alone it skips the AI run",
    },
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli emails edit eml_2SmZOWV3ZQ7W5x6g3m4p --prompt "Tighten the hero copy"',
    'brew-cli emails edit eml_2SmZOWV3ZQ7W5x6g3m4p --subject-line "Your September roundup"',
  ],
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      prompt: flagString(flags.prompt),
      emailVersionId: flagString(flags.emailVersionId),
      contentUrls: toStringArray(flags.contentUrls),
      subjectLine: flagString(flags.subjectLine),
    })
    const isPromptEdit = typeof input.prompt === 'string' && input.prompt !== ''
    const hasSubjectLine =
      typeof input.subjectLine === 'string' && input.subjectLine !== ''
    if (!(isPromptEdit || hasSubjectLine)) {
      throw new CliUsageError(
        '--prompt or --subject-line is required (or provide either via --input).'
      )
    }
    // Subject-only is a deterministic in-place patch server-side: no AI run,
    // no new version, and no credits — so it returns immediately.
    progress(
      ctx,
      isPromptEdit
        ? 'Editing email… (typically 30-90s)'
        : 'Setting the subject line…'
    )
    const result = await ctx
      .client()
      .emails.edit(
        asSdkInput<EditEmailInput>({ ...input, emailId: args.emailId ?? '' }),
        { timeoutMs: 240_000 }
      )
    return { data: result }
  },
})
