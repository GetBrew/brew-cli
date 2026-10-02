import { defineCommand } from '../../lib/define-command'
import { flagString } from '../../lib/input'

export const domainsHealthCommand = defineCommand({
  path: ['domains', 'health'],
  summary: 'Deliverability health: verdict, signals, DNS/auth, reputation',
  sdkMethod: 'domains.health',
  route: { method: 'GET', path: '/v1/domains/{domainId}/health' },
  commandClass: 'read',
  args: [
    { name: 'domainId', summary: 'Domain id to inspect', isRequired: true },
  ],
  flags: [
    {
      flag: '--include <tokens>',
      summary:
        'Comma-separated expansions: scoreHistory (up to 50 saved score snapshots, newest first), scoreRuns (the last 5 automated domain score runs)',
    },
  ],
  examples: [
    'brew-cli domains health kx7bkh53hasmfeh5kd7sqgykt187g8ww',
    'brew-cli domains health kx7bkh53hasmfeh5kd7sqgykt187g8ww --include scoreHistory,scoreRuns --json',
  ],
  run: async ({ ctx, args, flags }) => {
    const include = flagString(flags.include)
    return {
      data: await ctx.client().domains.health({
        domainId: args.domainId ?? '',
        ...(include === undefined ? {} : { include }),
      }),
    }
  },
})
