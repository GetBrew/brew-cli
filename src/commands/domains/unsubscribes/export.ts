import type { operations } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { flagString } from '../../../lib/input'
import { rawRequest } from '../../../lib/raw-request'

type Exported =
  operations['exportDomainUnsubscribes']['responses'][200]['content']['application/json']

/**
 * A domain's list as CSV text. Raw route because `@brew.new/sdk` 10 has no
 * method for it: once the CLI adopts SDK 11.2, bind
 * `domains.unsubscribes.export(...)` here and drop `isRawTransport`.
 */
export const domainsUnsubscribesExportCommand = defineCommand({
  path: ['domains', 'unsubscribes', 'export'],
  summary: "A domain's unsubscribe list as CSV (truncated when capped)",
  sdkMethod: null,
  isRawTransport: true,
  route: {
    method: 'GET',
    path: '/v1/domains/{domainId}/unsubscribes/export',
  },
  commandClass: 'read',
  args: [
    { name: 'domainId', summary: 'Marketing domain id', isRequired: true },
  ],
  flags: [
    {
      flag: '--scope <scope>',
      summary: 'any (default), domain or all',
    },
  ],
  examples: [
    'brew-cli domains unsubscribes export dom_123 > optouts.csv',
    'brew-cli domains unsubscribes export dom_123 --scope all --json',
  ],
  run: async ({ ctx, args, flags }) => {
    const body = await rawRequest<Exported>(ctx, {
      method: 'GET',
      path: `/v1/domains/${encodeURIComponent(args.domainId ?? '')}/unsubscribes/export`,
      query: { scope: flagString(flags.scope) },
    })
    return { data: body, human: body.csv }
  },
})
