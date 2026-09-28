import type { operations } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { rawRequest } from '../../../lib/raw-request'

type Removed =
  operations['removeDomainUnsubscribe']['responses'][200]['content']['application/json']

/**
 * Take one address off a domain's list. Raw route because `@brew.new/sdk` 10
 * has no method for it: once the CLI adopts SDK 11.2, bind
 * `domains.unsubscribes.remove(...)` here and drop `isRawTransport`.
 */
export const domainsUnsubscribesRemoveCommand = defineCommand({
  path: ['domains', 'unsubscribes', 'remove'],
  summary:
    "Take one address off a domain's unsubscribe list (never re-subscribes a brand-wide opt-out)",
  sdkMethod: null,
  isRawTransport: true,
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
    data: await rawRequest<Removed>(ctx, {
      method: 'DELETE',
      path: `/v1/domains/${encodeURIComponent(args.domainId ?? '')}/unsubscribes/${encodeURIComponent(args.email ?? '')}`,
    }),
  }),
})
