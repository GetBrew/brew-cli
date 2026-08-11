import type { ContactsResource } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  IDEMPOTENCY_FLAG,
  parseKeyValues,
  readTextFlag,
  requestOptions,
} from '../../lib/input'

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
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli contacts import-csv --file contacts.csv',
    'cat contacts.csv | brew-cli contacts import-csv --file - --mapping Email=email',
  ],
  run: async ({ ctx, flags }) => {
    const csv = await readTextFlag(ctx, flags.file, '--file')
    if (csv === undefined || csv.trim() === '') {
      throw new CliUsageError(
        '--file is required (a CSV path, or - for stdin).'
      )
    }
    const mapping = parseKeyValues(flags.mapping, '--mapping')
    const result = await ctx.client().contacts.importCsv(
      asSdkInput<ImportCsvContactsInput>({
        csv,
        ...(mapping === undefined ? {} : { mapping }),
      }),
      requestOptions(flags)
    )
    return { data: result }
  },
})
