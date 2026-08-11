import { apiCommand } from './commands/api'
import {
  configGetCommand,
  configListCommand,
  configSetCommand,
  configUnsetCommand,
} from './commands/config'
import { contactsCountCommand } from './commands/contacts/count'
import { contactsDeleteCommand } from './commands/contacts/delete'
import { contactsDeleteManyCommand } from './commands/contacts/delete-many'
import { contactsGetCommand } from './commands/contacts/get'
import { contactsImportCsvCommand } from './commands/contacts/import-csv'
import { contactsSearchCommand } from './commands/contacts/search'
import { contactsUpdateCommand } from './commands/contacts/update'
import { contactsUpsertCommand } from './commands/contacts/upsert'
import { contactsUpsertManyCommand } from './commands/contacts/upsert-many'
import { contactsValidateCommand } from './commands/contacts/validate'
import { docsApiCommand, docsCommand } from './commands/docs'
import { fieldsCreateCommand } from './commands/fields/create'
import { fieldsDeleteCommand } from './commands/fields/delete'
import { fieldsListCommand } from './commands/fields/list'
import { healthCommand } from './commands/health'
import { loginCommand } from './commands/login'
import { logoutCommand } from './commands/logout'
import { usageCommand } from './commands/usage'
import { whoamiCommand } from './commands/whoami'
import type { CommandSpec } from './lib/define-command'

/**
 * Every command the CLI exposes, in help-display order. One entry per
 * command file; the parity tests hold this list to the SDK surface and
 * the vendored OpenAPI spec.
 */
export const ALL_COMMANDS: readonly CommandSpec[] = [
  loginCommand,
  logoutCommand,
  whoamiCommand,
  configListCommand,
  configGetCommand,
  configSetCommand,
  configUnsetCommand,
  contactsSearchCommand,
  contactsGetCommand,
  contactsCountCommand,
  contactsUpsertCommand,
  contactsUpsertManyCommand,
  contactsUpdateCommand,
  contactsDeleteCommand,
  contactsDeleteManyCommand,
  contactsValidateCommand,
  contactsImportCsvCommand,
  fieldsListCommand,
  fieldsCreateCommand,
  fieldsDeleteCommand,
  healthCommand,
  usageCommand,
  docsCommand,
  docsApiCommand,
  apiCommand,
]
