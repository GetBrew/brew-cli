import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import {
  flagString,
  IDEMPOTENCY_FLAG,
  readTextFlag,
  requestOptions,
} from '../../../lib/input'

/** Add every address in a CSV to a domain's list. */
export const domainsUnsubscribesImportCommand = defineCommand({
  path: ['domains', 'unsubscribes', 'import'],
  summary: "Add every address in a CSV to a domain's unsubscribe list",
  sdkMethod: 'domains.unsubscribes.import',
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
    const body = await ctx.client().domains.unsubscribes.import(
      {
        domainId: args.domainId ?? '',
        csv,
        ...(column === undefined ? {} : { column }),
      },
      requestOptions(flags)
    )
    return { data: body }
  },
})
