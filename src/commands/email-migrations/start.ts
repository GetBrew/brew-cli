import type { StartEmailMigrationInput } from '@brew.new/sdk'
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

export const emailMigrationsStartCommand = defineCommand({
  path: ['email-migrations', 'start'],
  summary:
    'Preview connected historical email designs, or import an approved inventory',
  sdkMethod: 'emailMigrations.start',
  route: { method: 'POST', path: '/v1/email-migrations' },
  commandClass: 'write',
  flags: [
    {
      flag: '--capability-grant-id <capabilityGrantId>',
      summary:
        'Optional connected marketing_emails grant; omit when exactly one ready grant is available',
    },
    {
      flag: '--source-ids <sourceIds...>',
      summary: 'Provider email source IDs to inventory or import',
    },
    {
      flag: '--target-group <targetGroupId>',
      summary: 'Existing email group for imported designs',
    },
    {
      flag: '--dry-run',
      summary:
        'Inventory source availability and revisions without creating designs (default)',
    },
    {
      flag: '--execute',
      summary:
        'Import the source inventory after reviewing its dry-run results',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli email-migrations start --source-ids 12345 67890',
    'brew-cli email-migrations start --input \'{"capabilityGrantId":"grant_marketing_emails","items":[{"sourceId":"12345","expectedRevision":"revision-1"}]}\' --execute --idempotency-key approved-migration-1',
    'cat migration-inventory.json | brew-cli email-migrations start --input - --dry-run',
  ],
  run: async ({ ctx, flags }) => {
    if (flags.dryRun === true && flags.execute === true) {
      throw new CliUsageError('Choose --dry-run or --execute, not both.')
    }
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const sourceIds = toStringArray(flags.sourceIds)
    const input = mergeInput(base, {
      capabilityGrantId: flagString(flags.capabilityGrantId),
      items: sourceIds?.map((sourceId) => ({ sourceId })),
      targetGroupId: flagString(flags.targetGroup),
      dryRun:
        flags.execute === true
          ? false
          : flags.dryRun === true
            ? true
            : undefined,
    })
    if (
      input.capabilityGrantId !== undefined &&
      (typeof input.capabilityGrantId !== 'string' ||
        input.capabilityGrantId.trim() === '')
    ) {
      throw new CliUsageError(
        '--capability-grant-id must be nonempty when supplied.'
      )
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new CliUsageError(
        '--source-ids is required (or a nonempty items array via --input).'
      )
    }
    if (input.dryRun === undefined) input.dryRun = true
    if (typeof input.dryRun !== 'boolean')
      throw new CliUsageError('dryRun must be a boolean.')
    return {
      data: await ctx
        .client()
        .emailMigrations.start(
          asSdkInput<StartEmailMigrationInput>(input),
          requestOptions(flags)
        ),
    }
  },
})
