import { defineCommand } from '../../lib/define-command'

export const emailMigrationsGetCommand = defineCommand({
  path: ['email-migrations', 'get'],
  summary:
    'Read a migration cursor, per-source outcomes, limitations, and next action',
  sdkMethod: 'emailMigrations.get',
  route: { method: 'GET', path: '/v1/email-migrations/{migrationId}' },
  commandClass: 'read',
  args: [
    {
      name: 'migrationId',
      summary: 'Migration ID returned by start',
      isRequired: true,
    },
  ],
  examples: ['brew-cli email-migrations get emigration_123'],
  run: async ({ ctx, args }) => ({
    data: await ctx.client().emailMigrations.get(args.migrationId ?? ''),
  }),
})
