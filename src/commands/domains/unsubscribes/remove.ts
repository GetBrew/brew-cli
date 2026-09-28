import type { operations } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { progress } from '../../../lib/output'
import { rawRequest } from '../../../lib/raw-request'

type RemoveDomainUnsubscribeResponse =
  operations['removeDomainUnsubscribe']['responses'][200]['content']['application/json']

/**
 * Raw route because `@brew.new/sdk` 10 has no method for it: once the CLI
 * adopts the SDK release that ships it, bind that method here and drop
 * `isRawTransport`.
 */
export const domainsUnsubscribesRemoveCommand = defineCommand({
  path: ['domains', 'unsubscribes', 'remove'],
  summary:
    "Take one address off a marketing domain's unsubscribe list (resubscribes it to this domain only; idempotent)",
  sdkMethod: null,
  isRawTransport: true,
  route: {
    method: 'DELETE',
    path: '/v1/domains/{domainId}/unsubscribes/{email}',
  },
  commandClass: 'destructive',
  args: [
    {
      name: 'domainId',
      summary: 'Marketing domain id (from `domains list`)',
      isRequired: true,
    },
    {
      name: 'email',
      summary: 'Address to take off the list',
      isRequired: true,
    },
  ],
  examples: [
    'brew-cli domains unsubscribes remove kx7bkh53hasmfeh5kd7sqgykt187g8ww jane@example.com --yes',
  ],
  confirmSummary: ({ args }) =>
    `Remove ${args.email ?? ''} from the unsubscribe list of domain ${args.domainId ?? ''}. Marketing sends from this domain can reach the address again, unless it is unsubscribed brand-wide.`,
  // `removed: false` when the address was not on the list. The brand-wide
  // opt-out (`subscribed: false` on the contact) is never cleared here.
  run: async ({ ctx, args }) => {
    const email = args.email ?? ''
    const result = await rawRequest<RemoveDomainUnsubscribeResponse>(ctx, {
      method: 'DELETE',
      path: `/v1/domains/${encodeURIComponent(args.domainId ?? '')}/unsubscribes/${encodeURIComponent(email)}`,
    })
    if (result.globallyUnsubscribed) {
      progress(
        ctx,
        `${email} is still unsubscribed brand-wide, so every marketing send skips it. To resubscribe it everywhere: brew-cli contacts update ${email} --subscribed true`
      )
    }
    return { data: result }
  },
})
