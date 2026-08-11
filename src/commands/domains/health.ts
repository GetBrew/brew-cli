import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { rawRequest } from '../../lib/raw-request'

type DomainHealth = components['schemas']['DomainHealth']

export const domainsHealthCommand = defineCommand({
  path: ['domains', 'health'],
  summary: 'Deliverability health: verdict, signals, DNS/auth, reputation',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/domains/{domainId}/health' },
  commandClass: 'read',
  args: [
    { name: 'domainId', summary: 'Domain id to inspect', isRequired: true },
  ],
  examples: ['brew-cli domains health kx7bkh53hasmfeh5kd7sqgykt187g8ww'],
  run: async ({ ctx, args }) => ({
    data: await rawRequest<DomainHealth>(ctx, {
      method: 'GET',
      path: `/v1/domains/${encodeURIComponent(args.domainId ?? '')}/health`,
    }),
  }),
})
