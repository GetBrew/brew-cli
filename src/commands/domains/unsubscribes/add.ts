import type { operations } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import { flagString, IDEMPOTENCY_FLAG, toStringArray } from '../../../lib/input'
import { rawRequest } from '../../../lib/raw-request'

type Added =
  operations['addDomainUnsubscribes']['responses'][200]['content']['application/json']

/**
 * Suppress addresses from ONE marketing domain's mail. Raw route because
 * `@brew.new/sdk` 10 has no method for it: once the CLI adopts SDK 11.2,
 * bind `domains.unsubscribes.add(...)` here and drop `isRawTransport`.
 */
export const domainsUnsubscribesAddCommand = defineCommand({
  path: ['domains', 'unsubscribes', 'add'],
  summary:
    "Add addresses to a marketing domain's unsubscribe list (that domain only)",
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/domains/{domainId}/unsubscribes' },
  commandClass: 'write',
  args: [
    { name: 'domainId', summary: 'Marketing domain id', isRequired: true },
  ],
  flags: [
    {
      flag: '--email <addresses...>',
      summary: 'Address to suppress, repeatable (up to 1,000)',
    },
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli domains unsubscribes add dom_123 --email ada@example.com --email bo@example.com',
  ],
  run: async ({ ctx, args, flags }) => {
    const emails = toStringArray(flags.email)
    if (emails === undefined) {
      throw new CliUsageError('Pass at least one --email.')
    }
    const body = await rawRequest<Added>(ctx, {
      method: 'POST',
      path: `/v1/domains/${encodeURIComponent(args.domainId ?? '')}/unsubscribes`,
      body: { emails },
      idempotencyKey: flagString(flags.idempotencyKey),
    })
    return { data: body }
  },
})
