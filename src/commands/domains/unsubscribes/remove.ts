import { defineCommand } from '../../../lib/define-command'

/** Take one address off a domain's list. */
export const domainsUnsubscribesRemoveCommand = defineCommand({
  path: ['domains', 'unsubscribes', 'remove'],
  summary:
    "Take one address off a domain's unsubscribe list (never re-subscribes a brand-wide opt-out)",
  sdkMethod: 'domains.unsubscribes.remove',
  route: {
    method: 'DELETE',
    path: '/v1/domains/{domainId}/unsubscribes/{email}',
  },
  commandClass: 'write',
  args: [
    { name: 'domainId', summary: 'Marketing domain id', isRequired: true },
    { name: 'email', summary: 'Address to remove', isRequired: true },
  ],
  flags: [],
  examples: ['brew-cli domains unsubscribes remove dom_123 ada@example.com'],
  run: async ({ ctx, args }) => ({
    data: await ctx.client().domains.unsubscribes.remove({
      domainId: args.domainId ?? '',
      email: args.email ?? '',
    }),
  }),
})
