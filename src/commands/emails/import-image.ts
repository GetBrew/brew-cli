import type { BrewClient } from '@brew.new/sdk'
import { IMPORT_IMAGE_DEFAULT_TIMEOUT_MS } from '@brew.new/sdk'
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

type ImportImageInput = Parameters<BrewClient['emails']['importImage']>[0]

export const emailsImportImageCommand = defineCommand({
  path: ['emails', 'import-image'],
  summary:
    'Convert a picture of an email into an editable design (takes 1 to 6 minutes; costs credits)',
  sdkMethod: 'emails.importImage',
  route: { method: 'POST', path: '/v1/emails/image' },
  commandClass: 'write',
  isCredited: true,
  defaultTimeoutMs: IMPORT_IMAGE_DEFAULT_TIMEOUT_MS,
  flags: [
    INPUT_FLAG,
    {
      flag: '--url <imageUrl>',
      summary:
        'Public http(s) URL of a PNG, JPEG or WebP picture of one email, at most 2048 px wide',
    },
    {
      flag: '--title <title>',
      summary: 'Design title (default: Image Email)',
    },
    {
      flag: '--format <format>',
      summary: 'Representation returned in content: jsx (default) or html',
    },
    {
      flag: '--subject-line <text>',
      summary: "The design's default inbox subject line",
    },
    {
      flag: '--group-id <groupId>',
      summary: 'File the design under an existing group (grp_…), or ungrouped',
    },
    {
      flag: '--group-name <name>',
      summary:
        'File the design under a group found (or created) by this name; not with --group-id',
    },
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli emails import-image --url "https://example.com/launch-email.png"',
    'brew-cli emails import-image --url "https://example.com/launch-email.png" --format html --group-name "Launch"',
  ],
  run: async ({ ctx, flags }) => {
    const input = mergeInput(await readJsonFlag(ctx, flags.input, '--input'), {
      imageUrl: flagString(flags.url),
      title: flagString(flags.title),
      format: flagString(flags.format),
      subjectLine: flagString(flags.subjectLine),
      groupId: flagString(flags.groupId),
      groupName: flagString(flags.groupName),
    })
    if (!flagString(input.imageUrl)) {
      throw new CliUsageError(
        '--url is required (a public link to a picture of the email).'
      )
    }
    if (input.groupId !== undefined && input.groupName !== undefined) {
      throw new CliUsageError('Pass --group-id or --group-name, not both.')
    }
    return {
      data: await ctx
        .client()
        .emails.importImage(
          asSdkInput<ImportImageInput>(input),
          requestOptions(flags)
        ),
    }
  },
})
