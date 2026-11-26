import { defineCommand } from '../../lib/define-command'
import { IDEMPOTENCY_FLAG, requestOptions } from '../../lib/input'

export const emailMigrationsCancelCommand = defineCommand({
  path: ['email-migrations', 'cancel'],
  summary:
    'Cancel further migration work while keeping already imported designs',
  sdkMethod: 'emailMigrations.cancel',
  route: { method: 'POST', path: '/v1/email-migrations/{migrationId}/cancel' },
  commandClass: 'destructive',
  args: [
    {
      name: 'migrationId',
      summary: 'Migration ID to cancel permanently',
      isRequired: true,
    },
  ],
  flags: [IDEMPOTENCY_FLAG],
  examples: [
    'brew-cli email-migrations cancel emigration_123 --yes --idempotency-key cancel-migration-1',
  ],
  confirmSummary: ({ args }) =>
    `Cancel migration ${args.migrationId ?? ''}. Already imported designs remain; this migration cannot resume.`,
  run: async ({ ctx, args, flags }) => ({
    data: await ctx
      .client()
      .emailMigrations.cancel(args.migrationId ?? '', requestOptions(flags)),
  }),
})
