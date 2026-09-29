import type { operations } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import { flagString, IDEMPOTENCY_FLAG, readTextFlag } from '../../../lib/input'
import { rawRequest } from '../../../lib/raw-request'

type Imported =
  operations['importDomainUnsubscribes']['responses'][200]['content']['application/json']

/**
 * Add every address in a CSV to a domain's list. Raw route because
 * `@brew.new/sdk` 10 has no method for it: once the CLI adopts SDK 11.2,
 * bind `domains.unsubscribes.import(...)` here and drop `isRawTransport`.
 */
export const domainsUnsubscribesImportCommand = defineCommand({
  path: ['domains', 'unsubscribes', 'import'],
  summary: "Add every address in a CSV to a domain's unsubscribe list",
  sdkMethod: null,
  isRawTransport: true,
  route: {
    method: 'POST',
    path: '/v1/domains/{domainId}/unsubscribes/import',
  },
  commandClass: 'write',
  args: [
    { name: 'domainId', summary: 'Marketing domain id', isRequired: true },
  ],
  flags: [
    { flag: '--file <path>', summary: 'CSV file, or - for stdin' },
    {
      flag: '--column <header>',
      summary: 'The column holding the addresses (by header)',
    },
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli domains unsubscribes import dom_123 --file optouts.csv --column Email',
  ],
  run: async ({ ctx, args, flags }) => {
    const csv = await readTextFlag(ctx, flags.file, '--file')
    if (csv === undefined || csv.trim() === '') {
      throw new CliUsageError(
        '--file is required (a CSV path, or - for stdin).'
      )
    }
    const column = flagString(flags.column)
    const body = await rawRequest<Imported>(ctx, {
      method: 'POST',
      path: `/v1/domains/${encodeURIComponent(args.domainId ?? '')}/unsubscribes/import`,
      body: { csv, ...(column === undefined ? {} : { column }) },
      idempotencyKey: flagString(flags.idempotencyKey),
    })
    return { data: body }
  },
})
