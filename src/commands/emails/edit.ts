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

/**
 * What a PATCH without a prompt changes in place: no AI run, no new version,
 * no credits. The API needs a prompt or at least one of these.
 */
const ENVELOPE_FIELDS = ['title', 'subjectLine', 'groupId'] as const

function isText(value: unknown): boolean {
  return typeof value === 'string' && value !== ''
}

export const emailsEditCommand = defineCommand({
  path: ['emails', 'edit'],
  summary:
    'AI-edit an email design, and/or set its subject line, title or group (free without a prompt)',
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
    {
      flag: '--title <text>',
      summary: 'Rename the design (its canvas name); alone it skips the AI run',
    },
    {
      flag: '--group-id <groupId>',
      summary:
        'Move the design into this existing group; alone it skips the AI run',
    },
    {
      flag: '--ungroup',
      summary: 'Move the design to Ungrouped (groupId: null)',
    },
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli emails edit eml_2SmZOWV3ZQ7W5x6g3m4p --prompt "Tighten the hero copy"',
    'brew-cli emails edit eml_2SmZOWV3ZQ7W5x6g3m4p --subject-line "Your September roundup"',
    'brew-cli emails edit eml_2SmZOWV3ZQ7W5x6g3m4p --title "Fall sale v2" --group-id grp_7Hq2',
    'brew-cli emails edit eml_2SmZOWV3ZQ7W5x6g3m4p --ungroup',
  ],
  run: async ({ ctx, args, flags }) => {
    const groupId = flagString(flags.groupId)
    if (groupId !== undefined && flags.ungroup === true) {
      throw new CliUsageError(
        '--group-id and --ungroup conflict: pick one group move.'
      )
    }
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      prompt: flagString(flags.prompt),
      emailVersionId: flagString(flags.emailVersionId),
      contentUrls: toStringArray(flags.contentUrls),
      subjectLine: flagString(flags.subjectLine),
      title: flagString(flags.title),
      groupId: flags.ungroup === true ? null : groupId,
    })
    const isPromptEdit = isText(input.prompt)
    // `groupId: null` is a real value: it moves the design to Ungrouped.
    const envelope = ENVELOPE_FIELDS.filter(
      (field) =>
        isText(input[field]) || (field === 'groupId' && input[field] === null)
    )
    if (!isPromptEdit && envelope.length === 0) {
      throw new CliUsageError(
        'Pass --prompt, or at least one of --subject-line, --title, --group-id or --ungroup (or those fields via --input).'
      )
    }
    // Without a prompt the patch is deterministic server-side: no AI run, no
    // new version, and no credits, so it returns immediately.
    progress(
      ctx,
      isPromptEdit
        ? 'Editing email… (typically 30-90s)'
        : envelope.length === 1 && envelope[0] === 'subjectLine'
          ? 'Setting the subject line…'
          : 'Updating the design (no AI run)…'
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
