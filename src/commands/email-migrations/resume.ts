import { defineCommand } from '../../lib/define-command'
import { IDEMPOTENCY_FLAG, requestOptions } from '../../lib/input'

export const emailMigrationsResumeCommand = defineCommand({
  path: ['email-migrations', 'resume'],
  summary:
    'Resume a held migration from its cursor with the original preview or import mode',
  sdkMethod: 'emailMigrations.resume',
  route: { method: 'POST', path: '/v1/email-migrations/{migrationId}/resume' },
  commandClass: 'write',
  args: [
    {
      name: 'migrationId',
      summary: 'Migration ID whose nextAction is resume',
      isRequired: true,
    },
  ],
  flags: [IDEMPOTENCY_FLAG],
  examples: [
    'brew-cli email-migrations resume emigration_123 --idempotency-key resume-migration-1',
  ],
  run: async ({ ctx, args, flags }) => ({
    data: await ctx
      .client()
      .emailMigrations.resume(args.migrationId ?? '', requestOptions(flags)),
  }),
})
