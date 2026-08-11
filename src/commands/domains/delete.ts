import { defineCommand } from '../../lib/define-command'

export const domainsDeleteCommand = defineCommand({
  path: ['domains', 'delete'],
  summary: 'Delete a sending domain',
  sdkMethod: 'domains.delete',
  route: { method: 'DELETE', path: '/v1/domains/{domainId}' },
  commandClass: 'destructive',
  args: [
    { name: 'domainId', summary: 'Domain id to delete', isRequired: true },
  ],
  examples: ['brew-cli domains delete dom_8s1Kj --yes'],
  confirmSummary: ({ args }) =>
    `Delete sending domain ${args.domainId ?? ''}. Future sends from it will fail until it is re-added and re-verified. This cannot be undone.`,
  run: async ({ ctx, args }) => ({
    data: await ctx.client().domains.delete({ domainId: args.domainId ?? '' }),
  }),
})
