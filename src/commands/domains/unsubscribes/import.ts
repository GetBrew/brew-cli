import type { operations } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import { flagString, IDEMPOTENCY_FLAG, readTextFlag } from '../../../lib/input'
import { progress } from '../../../lib/output'
import { rawRequest } from '../../../lib/raw-request'

type ImportDomainUnsubscribesRequest =
  operations['importDomainUnsubscribes']['requestBody']['content']['application/json']
type ImportDomainUnsubscribesResponse =
  operations['importDomainUnsubscribes']['responses'][200]['content']['application/json']

/**
 * Raw route because `@brew.new/sdk` 10 has no method for it: once the CLI
 * adopts the SDK release that ships it, bind that method here and drop
 * `isRawTransport`.
 */
export const domainsUnsubscribesImportCommand = defineCommand({
  path: ['domains', 'unsubscribes', 'import'],
  summary:
    "Import a CSV (another ESP's unsubscribe export) into a marketing domain's unsubscribe list: 10,000 rows per call",
  sdkMethod: null,
  isRawTransport: true,
  route: {
    method: 'POST',
    path: '/v1/domains/{domainId}/unsubscribes/import',
  },
  commandClass: 'write',
  args: [
    {
      name: 'domainId',
      summary: 'Marketing domain id (from `domains list`)',
      isRequired: true,
    },
  ],
  flags: [
    { flag: '--file <path>', summary: 'CSV file to import, or - for stdin' },
    {
      flag: '--column <header>',
      summary:
        'Header of the address column, when detection fails (default: an email header or the column of addresses)',
    },
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli domains unsubscribes import kx7bkh53hasmfeh5kd7sqgykt187g8ww --file unsubscribes.csv',
    'cat export.csv | brew-cli domains unsubscribes import kx7bkh53hasmfeh5kd7sqgykt187g8ww --file - --column "Email Address"',
  ],
  // Idempotent per address. The contact CSV importer's `subscribed` column
  // is the brand-wide flag; this is the per-domain list.
  run: async ({ ctx, args, flags }) => {
    const csv = await readTextFlag(ctx, flags.file, '--file')
    if (csv === undefined || csv.trim() === '') {
      throw new CliUsageError(
        '--file is required (a CSV path, or - for stdin).'
      )
    }
    const column = flagString(flags.column)
    const body: ImportDomainUnsubscribesRequest = {
      csv,
      ...(column === undefined ? {} : { column }),
    }
    const result = await rawRequest<ImportDomainUnsubscribesResponse>(ctx, {
      method: 'POST',
      path: `/v1/domains/${encodeURIComponent(args.domainId ?? '')}/unsubscribes/import`,
      body,
      idempotencyKey: flagString(flags.idempotencyKey),
    })
    if (result.truncated) {
      progress(
        ctx,
        'Truncated: one call reads 10,000 rows and the file has more. Split it and import the rest in further calls.'
      )
    }
    return { data: result }
  },
})
