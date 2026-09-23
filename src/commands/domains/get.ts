import { defineCommand } from '../../lib/define-command'

export const domainsGetCommand = defineCommand({
  path: ['domains', 'get'],
  summary: 'Fetch one sending domain by id — the bare row',
  sdkMethod: 'domains.get',
  route: { method: 'GET', path: '/v1/domains/{domainId}' },
  commandClass: 'read',
  args: [{ name: 'domainId', summary: 'Domain id to fetch', isRequired: true }],
  examples: ['brew-cli domains get dom_3k9sQ'],
  run: async ({ ctx, args }) => ({
    data: await ctx.client().domains.get(args.domainId ?? ''),
  }),
})
