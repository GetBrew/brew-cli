import type { EmailImportInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  readTextFlag,
  requestOptions,
} from '../../lib/input'

export const emailsImportCommand = defineCommand({
  path: ['emails', 'import'],
  summary: 'Import existing HTML, MJML, or JSX as a new editable design',
  sdkMethod: 'emails.import',
  route: { method: 'POST', path: '/v1/emails/import' },
  commandClass: 'write',
  flags: [
    {
      flag: '--file <path>',
      summary: 'Source file to import, or - for stdin',
    },
    { flag: '--format <format>', summary: 'Source format: html | mjml | jsx' },
    { flag: '--title <title>', summary: 'Design title' },
    {
      flag: '--base-url <url>',
      summary: 'Base URL for resolving relative asset links',
    },
    {
      flag: '--subject-line <text>',
      summary: "The design's default inbox subject line",
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli emails import --file newsletter.html --format html --title "Legacy newsletter"',
    'brew-cli emails import --file newsletter.html --format html --subject-line "This month at Brew"',
    'cat email.html | brew-cli emails import --file - --format html',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const content = await readTextFlag(ctx, flags.file, '--file')
    const input = mergeInput(base, {
      content,
      format: flagString(flags.format),
      title: flagString(flags.title),
      baseUrl: flagString(flags.baseUrl),
      subjectLine: flagString(flags.subjectLine),
    })
    if (typeof input.content !== 'string' || input.content.trim() === '') {
      throw new CliUsageError(
        '--file is required (a path, or - for stdin), or content via --input.'
      )
    }
    if (typeof input.format !== 'string') {
      throw new CliUsageError('--format is required: html | mjml | jsx.')
    }
    const result = await ctx
      .client()
      .emails.import(asSdkInput<EmailImportInput>(input), requestOptions(flags))
    return { data: result }
  },
})
