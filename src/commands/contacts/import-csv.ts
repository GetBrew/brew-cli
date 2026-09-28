import type { ContactsResource } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  parseKeyValues,
  readJsonFlag,
  readTextFlag,
  requestOptions,
} from '../../lib/input'

// SDK 10's `importCsv` types only `{ csv, mapping, validate }` but sends
// its input as the body, so `dateOrder` and `consent` reach the API through
// the boundary cast until the CLI adopts SDK 11.2.
type ImportCsvContactsInput = Parameters<ContactsResource['importCsv']>[0]

export const contactsImportCsvCommand = defineCommand({
  path: ['contacts', 'import-csv'],
  summary: 'Bulk-import contacts from a CSV file or stdin',
  sdkMethod: 'contacts.importCsv',
  route: { method: 'POST', path: '/v1/contacts/import-csv' },
  commandClass: 'write',
  flags: [
    { flag: '--file <path>', summary: 'CSV file to import, or - for stdin' },
    {
      flag: '--mapping <pairs...>',
      summary: 'Column mapping csvColumn=fieldName, repeatable',
    },
    {
      flag: '--date-order <order>',
      summary:
        'month_first or day_first: how to read dates like 03/04/2026 (a day over 12 in the column wins; default month-first, with a DATE_ORDER_ASSUMED warning)',
    },
    {
      flag: '--validate',
      summary:
        'Deliverability-check every imported address (2 credits per address)',
    },
    {
      flag: '--consent-source <source>',
      summary:
        'Stamp a marketing consent record on every row: api, form or import (the full record goes in --input)',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli contacts import-csv --file contacts.csv',
    'cat contacts.csv | brew-cli contacts import-csv --file - --mapping Email=email',
    'brew-cli contacts import-csv --file eu-signups.csv --date-order day_first --consent-source import',
  ],
  run: async ({ ctx, flags }) => {
    if (flags.input === '-' && flags.file === '-') {
      throw new CliUsageError('Only one of --input and --file can read stdin.')
    }
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const csv = await readTextFlag(ctx, flags.file, '--file')
    if (csv === undefined || csv.trim() === '') {
      throw new CliUsageError(
        '--file is required (a CSV path, or - for stdin).'
      )
    }
    const consentSource = flagString(flags.consentSource)
    const input = mergeInput(base, {
      csv,
      mapping: parseKeyValues(flags.mapping, '--mapping'),
      dateOrder: flagString(flags.dateOrder),
      validate: flags.validate === true ? true : undefined,
      consent:
        consentSource === undefined ? undefined : { source: consentSource },
    })
    const result = await ctx
      .client()
      .contacts.importCsv(
        asSdkInput<ImportCsvContactsInput>(input),
        requestOptions(flags)
      )
    return { data: result }
  },
})
