import { defineCommand } from '../../lib/define-command'
import { CliApiError } from '../../lib/errors'

export const domainsGetCommand = defineCommand({
  path: ['domains', 'get'],
  summary: 'Fetch one sending domain by id',
  sdkMethod: null,
  derivedFrom: 'domains.list',
  route: { method: 'GET', path: '/v1/domains' },
  commandClass: 'read',
  args: [{ name: 'domainId', summary: 'Domain id to fetch', isRequired: true }],
  examples: ['brew-cli domains get dom_3k9sQ'],
  run: async ({ ctx, args }) => {
    const domainId = args.domainId ?? ''
    const result = await ctx.client().domains.list({ domainId })
    const domain = result.data[0]
    if (domain === undefined) {
      throw new CliApiError({
        status: 404,
        code: 'DOMAIN_NOT_FOUND',
        type: 'not_found',
        message: `No domain found for ${domainId}`,
        suggestion: 'List domains with `brew-cli domains list`.',
      })
    }
    return { data: domain }
  },
})
