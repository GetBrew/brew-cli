import type { ExportDomainUnsubscribesInput } from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import { asSdkInput, flagString } from '../../../lib/input'

/** A domain's list as CSV text. */
export const domainsUnsubscribesExportCommand = defineCommand({
  path: ['domains', 'unsubscribes', 'export'],
  summary: "A domain's unsubscribe list as CSV (truncated when capped)",
  sdkMethod: 'domains.unsubscribes.export',
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
    const scope = flagString(flags.scope)
    // --scope passes through unchecked: the API validates it.
    const body = await ctx.client().domains.unsubscribes.export(
      asSdkInput<ExportDomainUnsubscribesInput>({
        domainId: args.domainId ?? '',
        ...(scope === undefined ? {} : { scope }),
      })
    )
    return { data: body, human: body.csv }
  },
})
