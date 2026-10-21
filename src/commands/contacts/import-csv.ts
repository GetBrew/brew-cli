import { basename } from 'node:path'
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
import { DRY_RUN_FLAG, importModeFlags, ON_CONFLICT_FLAG } from './import-modes'
import { renderImportResult } from './import-summary'

type ImportCsvContactsInput = Parameters<ContactsResource['importCsv']>[0]

export const contactsImportCsvCommand = defineCommand({
  path: ['contacts', 'import-csv'],
  summary:
    'Bulk-import contacts from a CSV file or stdin as one Import History batch (free; validation charged separately)',
  sdkMethod: 'contacts.importCsv',
  route: { method: 'POST', path: '/v1/contacts/import-csv' },
  commandClass: 'write',
  flags: [
    {
      flag: '--file <path>',
      summary: 'CSV file to import, or - for stdin (or csv in --input)',
    },
    {
      flag: '--file-name <name>',
      summary:
        "Name the batch in Brew's Import History (default: the --file name)",
    },
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
        'Deliverability checks: up to 100 submitted CSV data rows cost 2 credits/row inline; larger files use background checks when needed, charged per address',
    },
    {
      flag: '--consent-source <source>',
      summary:
        'Stamp a marketing consent record on every row: api, form or import (sets the source of a record given in --input)',
    },
    DRY_RUN_FLAG,
    ON_CONFLICT_FLAG,
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli contacts import-csv --file contacts.csv',
    'cat contacts.csv | brew-cli contacts import-csv --file - --mapping Email=email',
    'brew-cli contacts import-csv --file eu-signups.csv --date-order day_first --consent-source import',
    'brew-cli contacts import-csv --file contacts.csv --dry-run',
    'brew-cli contacts import-csv --file contacts.csv --on-conflict skip',
  ],
  run: async ({ ctx, flags }) => {
    if (flags.input === '-' && flags.file === '-') {
      throw new CliUsageError('Only one of --input and --file can read stdin.')
    }
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const consentSource = flagString(flags.consentSource)
    const input = mergeInput(base, {
      csv: await readTextFlag(ctx, flags.file, '--file'),
      mapping: parseKeyValues(flags.mapping, '--mapping'),
      dateOrder: flagString(flags.dateOrder),
      validate: flags.validate === true ? true : undefined,
      ...importModeFlags(flags),
    })
    const fileName = importFileName(flags, input)
    if (fileName !== undefined) {
      input.fileName = fileName
    }
    if (typeof input.csv !== 'string' || input.csv.trim() === '') {
      throw new CliUsageError(
        'Pass the CSV with --file (a path, or - for stdin) or as csv in --input.'
      )
    }
    if (consentSource !== undefined) {
      // --consent-source sets the source; a record from --input keeps its
      // capturedAt, policyVersion and evidence.
      const record = input.consent
      input.consent = {
        ...(typeof record === 'object' && record !== null ? record : {}),
        source: consentSource,
      }
    }
    const result = await ctx
      .client()
      .contacts.importCsv(
        asSdkInput<ImportCsvContactsInput>(input),
        requestOptions(flags)
      )
    return {
      data: result,
      human: () =>
        renderImportResult(
          result,
          typeof input.fileName === 'string' ? input.fileName : undefined
        ),
    }
  },
})

/**
 * The Import History name: `--file-name`, else a `fileName` the JSON body
 * already carries, else the file's own name (stdin has none, so the batch is
 * named by its source in Brew). `undefined` leaves the body's value alone.
 */
export function importFileName(
  flags: { readonly fileName?: unknown; readonly file?: unknown },
  body: Readonly<Record<string, unknown>> = {}
): string | undefined {
  const explicit = flagString(flags.fileName)
  if (explicit !== undefined) {
    return explicit
  }
  if (typeof body.fileName === 'string') {
    return
  }
  const file = flagString(flags.file)
  return file === undefined || file === '-' ? undefined : basename(file)
}
