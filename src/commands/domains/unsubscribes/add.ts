import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import {
  IDEMPOTENCY_FLAG,
  requestOptions,
  toStringArray,
} from '../../../lib/input'

/** Suppress addresses from ONE marketing domain's mail. */
export const domainsUnsubscribesAddCommand = defineCommand({
  path: ['domains', 'unsubscribes', 'add'],
  summary:
    "Add addresses to a marketing domain's unsubscribe list (that domain only)",
  sdkMethod: 'domains.unsubscribes.add',
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
    const body = await ctx
      .client()
      .domains.unsubscribes.add(
        { domainId: args.domainId ?? '', emails: [...emails] },
        requestOptions(flags)
      )
    return { data: body }
  },
})
