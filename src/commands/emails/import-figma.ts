import type { BrewClient } from '@brew.new/sdk'
import { IMPORT_FIGMA_DEFAULT_TIMEOUT_MS } from '@brew.new/sdk'
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

type ImportFigmaInput = Parameters<BrewClient['emails']['importFigma']>[0]

export const emailsImportFigmaCommand = defineCommand({
  path: ['emails', 'import-figma'],
  summary:
    'Convert one Figma frame into an editable design (deterministic, free)',
  sdkMethod: 'emails.importFigma',
  route: { method: 'POST', path: '/v1/emails/figma' },
  commandClass: 'write',
  defaultTimeoutMs: IMPORT_FIGMA_DEFAULT_TIMEOUT_MS,
  flags: [
    INPUT_FLAG,
    {
      flag: '--url <figmaUrl>',
      summary: 'Figma frame link; must include a node-id query parameter',
    },
    {
      flag: '--title <title>',
      summary: 'Design title (default: the Figma frame name)',
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
    'brew-cli emails import-figma --url "https://www.figma.com/design/abc123/Launch?node-id=1-2"',
    'brew-cli emails import-figma --url "https://www.figma.com/design/abc123/Launch?node-id=1-2" --subject-line "Launch day is here"',
  ],
  run: async ({ ctx, flags }) => {
    const input = mergeInput(await readJsonFlag(ctx, flags.input, '--input'), {
      figmaUrl: flagString(flags.url),
      title: flagString(flags.title),
      format: flagString(flags.format),
      subjectLine: flagString(flags.subjectLine),
      groupId: flagString(flags.groupId),
      groupName: flagString(flags.groupName),
    })
    if (flagString(input.figmaUrl) === undefined) {
      throw new CliUsageError(
        '--url is required (a Figma frame link containing node-id).'
      )
    }
    if (input.groupId !== undefined && input.groupName !== undefined) {
      throw new CliUsageError('Pass --group-id or --group-name, not both.')
    }
    return {
      data: await ctx
        .client()
        .emails.importFigma(
          asSdkInput<ImportFigmaInput>(input),
          requestOptions(flags)
        ),
    }
  },
})
