import type { operations } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { flagString } from '../../../lib/input'
import { progress } from '../../../lib/output'
import { rawRequest } from '../../../lib/raw-request'
import { UNSUBSCRIBE_SCOPE_FLAG } from './list'

type ExportDomainUnsubscribesResponse =
  operations['exportDomainUnsubscribes']['responses'][200]['content']['application/json']

/**
 * Raw route because `@brew.new/sdk` 10 has no method for it: once the CLI
 * adopts the SDK release that ships it, bind that method here and drop
 * `isRawTransport`.
 */
export const domainsUnsubscribesExportCommand = defineCommand({
  path: ['domains', 'unsubscribes', 'export'],
  summary:
    "Export a marketing domain's unsubscribe list as CSV text (raw CSV on a TTY; capped at 50,000 rows or ~4 MB)",
  sdkMethod: null,
  isRawTransport: true,
  route: {
    method: 'GET',
    path: '/v1/domains/{domainId}/unsubscribes/export',
  },
  commandClass: 'read',
  args: [
    {
      name: 'domainId',
      summary: 'Marketing domain id (from `domains list`)',
      isRequired: true,
    },
  ],
  flags: [UNSUBSCRIBE_SCOPE_FLAG],
  examples: [
    'brew-cli domains unsubscribes export kx7bkh53hasmfeh5kd7sqgykt187g8ww',
    'brew-cli domains unsubscribes export kx7bkh53hasmfeh5kd7sqgykt187g8ww --scope domain --json | jq -r .csv > unsubscribes.csv',
  ],
  // Columns: Email,Scope,Unsubscribed At,Source,Send ID. JSON mode prints
  // the API envelope (`csv`, `rowCount`, `truncated`).
  run: async ({ ctx, args, flags }) => {
    const result = await rawRequest<ExportDomainUnsubscribesResponse>(ctx, {
      method: 'GET',
      path: `/v1/domains/${encodeURIComponent(args.domainId ?? '')}/unsubscribes/export`,
      query: { scope: flagString(flags.scope) },
    })
    if (result.truncated) {
      progress(
        ctx,
        `Truncated at ${result.rowCount} rows (the export cap is 50,000 rows or ~4 MB). Narrow it with --scope.`
      )
    }
    return { data: result, human: result.csv.replace(/\r?\n$/, '') }
  },
})
