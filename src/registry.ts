import { analyticsAutomationsCommand } from './commands/analytics/automations'
import { analyticsCampaignsCommand } from './commands/analytics/campaigns'
import { analyticsEventsCommand } from './commands/analytics/events'
import { analyticsSendsGetCommand } from './commands/analytics/sends/get'
import { analyticsSendsListCommand } from './commands/analytics/sends/list'
import { analyticsTriggerInstancesListCommand } from './commands/analytics/trigger-instances/list'
import { apiCommand } from './commands/api'
import { audiencesCreateCommand } from './commands/audiences/create'
import { audiencesDeleteCommand } from './commands/audiences/delete'
import { audiencesGetCommand } from './commands/audiences/get'
import { audiencesListCommand } from './commands/audiences/list'
import { audiencesUpdateCommand } from './commands/audiences/update'
import { automationsCreateCommand } from './commands/automations/create'
import { automationsDeleteCommand } from './commands/automations/delete'
import { automationsGetCommand } from './commands/automations/get'
import { automationsListCommand } from './commands/automations/list'
import { automationsPublishCommand } from './commands/automations/publish'
import { automationsRunsListCommand } from './commands/automations/runs/list'
import { automationsTestCommand } from './commands/automations/test'
import { automationsTriggersCreateCommand } from './commands/automations/triggers/create'
import { automationsTriggersDeleteCommand } from './commands/automations/triggers/delete'
import { automationsTriggersFireCommand } from './commands/automations/triggers/fire'
import { automationsTriggersListCommand } from './commands/automations/triggers/list'
import { automationsTriggersUpdateCommand } from './commands/automations/triggers/update'
import { automationsUnpublishCommand } from './commands/automations/unpublish'
import { automationsUpdateCommand } from './commands/automations/update'
import { brandGetCommand } from './commands/brand/get'
import { brandGetImagesCommand } from './commands/brand/get-images'
import { brandUpdateCommand } from './commands/brand/update'
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
import { contentAddImageCommand } from './commands/content/add-image'
import { contentGenerateImageCommand } from './commands/content/generate-image'
import { contentGifCommand } from './commands/content/gif'
import { contentHtmlToPngCommand } from './commands/content/html-to-png'
import { contentTransformCommand } from './commands/content/transform'
import { docsApiCommand, docsCommand } from './commands/docs'
import { domainsAddCommand } from './commands/domains/add'
import { domainsDeleteCommand } from './commands/domains/delete'
import { domainsGetCommand } from './commands/domains/get'
import { domainsListCommand } from './commands/domains/list'
import { domainsUpdateCommand } from './commands/domains/update'
import { domainsVerifyCommand } from './commands/domains/verify'
import { emailsDeleteCommand } from './commands/emails/delete'
import { emailsEditCommand } from './commands/emails/edit'
import { emailsGenerateCommand } from './commands/emails/generate'
import { emailsGetCommand } from './commands/emails/get'
import { emailsImportCommand } from './commands/emails/import'
import { emailsListCommand } from './commands/emails/list'
import { emailsRestoreCommand } from './commands/emails/restore'
import { emailsSendCommand } from './commands/emails/send'
import { fieldsCreateCommand } from './commands/fields/create'
import { fieldsDeleteCommand } from './commands/fields/delete'
import { fieldsListCommand } from './commands/fields/list'
import { healthCommand } from './commands/health'
import { loginCommand } from './commands/login'
import { logoutCommand } from './commands/logout'
import { sendsCancelCommand } from './commands/sends/cancel'
import { templatesListCommand } from './commands/templates/list'
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
  emailsListCommand,
  emailsGetCommand,
  emailsGenerateCommand,
  emailsImportCommand,
  emailsEditCommand,
  emailsRestoreCommand,
  emailsDeleteCommand,
  emailsSendCommand,
  sendsCancelCommand,
  audiencesListCommand,
  audiencesGetCommand,
  audiencesCreateCommand,
  audiencesUpdateCommand,
  audiencesDeleteCommand,
  automationsListCommand,
  automationsGetCommand,
  automationsCreateCommand,
  automationsUpdateCommand,
  automationsPublishCommand,
  automationsUnpublishCommand,
  automationsDeleteCommand,
  automationsTestCommand,
  automationsTriggersListCommand,
  automationsTriggersCreateCommand,
  automationsTriggersUpdateCommand,
  automationsTriggersDeleteCommand,
  automationsTriggersFireCommand,
  automationsRunsListCommand,
  analyticsCampaignsCommand,
  analyticsAutomationsCommand,
  analyticsEventsCommand,
  analyticsSendsListCommand,
  analyticsSendsGetCommand,
  analyticsTriggerInstancesListCommand,
  brandGetCommand,
  brandUpdateCommand,
  brandGetImagesCommand,
  domainsListCommand,
  domainsGetCommand,
  domainsAddCommand,
  domainsVerifyCommand,
  domainsUpdateCommand,
  domainsDeleteCommand,
  contentGenerateImageCommand,
  contentGifCommand,
  contentTransformCommand,
  contentHtmlToPngCommand,
  contentAddImageCommand,
  templatesListCommand,
  healthCommand,
  usageCommand,
  docsCommand,
  docsApiCommand,
  apiCommand,
]
