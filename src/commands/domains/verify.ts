import { defineCommand } from '../../lib/define-command'

export const domainsVerifyCommand = defineCommand({
  path: ['domains', 'verify'],
  summary: 'Re-check DNS records and refresh domain verification',
  sdkMethod: 'domains.verify',
  route: { method: 'POST', path: '/v1/domains/{domainId}/verify' },
  commandClass: 'write',
  args: [
    { name: 'domainId', summary: 'Domain id to verify', isRequired: true },
  ],
  examples: ['brew-cli domains verify dom_8s1Kj'],
  run: async ({ ctx, args }) => ({
    data: await ctx.client().domains.verify({ domainId: args.domainId ?? '' }),
  }),
})
