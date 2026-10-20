import type { ContactsResource } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  readTextFlag,
  requestOptions,
} from '../../lib/input'
import { importFileName } from './import-csv'

type ImportContactsInput = Parameters<ContactsResource['import']>[0]

export const contactsImportCommand = defineCommand({
  path: ['contacts', 'import'],
  summary:
    'Bulk-import up to 1000 contacts from a JSON file or stdin as one Import History batch (free; --validate costs 2 credits per address)',
  sdkMethod: 'contacts.import',
  route: { method: 'POST', path: '/v1/contacts/import' },
  commandClass: 'write',
  flags: [
    {
      flag: '--file <path>',
      summary:
        'JSON file of contacts (an array, or { "contacts": [...] }), or - for stdin',
    },
    {
      flag: '--file-name <name>',
      summary:
        "Name the batch in Brew's Import History (default: the --file name)",
    },
    {
      flag: '--validate',
      summary:
        'Deliverability-check every imported address (2 credits per address)',
    },
    {
      flag: '--consent-source <source>',
      summary:
        'Default marketing consent record for rows without their own: api, form or import',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli contacts import --file contacts.json --consent-source import',
    'cat contacts.json | brew-cli contacts import --file - --file-name crm-export.json',
  ],
  run: async ({ ctx, flags }) => {
    if (flags.input === '-' && flags.file === '-') {
      throw new CliUsageError('Only one of --input and --file can read stdin.')
    }
    const fromFile = parseContactsFile(
      await readTextFlag(ctx, flags.file, '--file')
    )
    const base = await readJsonFlag(ctx, flags.input, '--input')
    // The file's body (an array, or an object that may carry `validate`,
    // `consent` or `fileName`) layers over --input; flags apply only when
    // given, so a value the body set is never replaced by an absent flag.
    const body = mergeInput(
      Array.isArray(base) ? { contacts: base } : base,
      asBody(fromFile)
    )
    const input = mergeInput(body, {
      fileName: importFileName(flags, body),
      validate: flags.validate === true ? true : undefined,
    })
    if (!Array.isArray(input.contacts) || input.contacts.length === 0) {
      throw new CliUsageError(
        'Pass the contacts with --file (a JSON array or { "contacts": [...] }, or - for stdin) or as contacts in --input.'
      )
    }
    const consentSource = flagString(flags.consentSource)
    if (consentSource !== undefined) {
      const record = input.consent
      input.consent = {
        ...(typeof record === 'object' && record !== null ? record : {}),
        source: consentSource,
      }
    }
    const result = await ctx
      .client()
      .contacts.import(
        asSdkInput<ImportContactsInput>(input),
        requestOptions(flags)
      )
    return { data: result }
  },
})

function asBody(fromFile: unknown): Record<string, unknown> {
  if (fromFile === undefined) {
    return {}
  }
  if (Array.isArray(fromFile)) {
    return { contacts: fromFile }
  }
  if (fromFile === null || typeof fromFile !== 'object') {
    throw new CliUsageError(
      '--file must hold JSON: an array of contacts or { "contacts": [...] }'
    )
  }
  return fromFile as Record<string, unknown>
}

function parseContactsFile(text: string | undefined): unknown {
  if (text === undefined) {
    return
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new CliUsageError(
      '--file must hold JSON: an array of contacts or { "contacts": [...] }'
    )
  }
}
