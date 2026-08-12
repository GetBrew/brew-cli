import { analyticsAutomationsCommand } from './commands/analytics/automations'
import { analyticsCampaignsCommand } from './commands/analytics/campaigns'
import { analyticsEventsCommand } from './commands/analytics/events'
import { analyticsOverviewCommand } from './commands/analytics/overview'
import { analyticsSendsGetCommand } from './commands/analytics/sends/get'
import { analyticsSendsListCommand } from './commands/analytics/sends/list'
import { analyticsTriggerInstancesListCommand } from './commands/analytics/trigger-instances/list'
import { apiCommand } from './commands/api'
import { audiencesCreateCommand } from './commands/audiences/create'
import { audiencesDeleteCommand } from './commands/audiences/delete'
import { audiencesDuplicateCommand } from './commands/audiences/duplicate'
import { audiencesFromEventsCommand } from './commands/audiences/from-events'
import { audiencesGetCommand } from './commands/audiences/get'
import { audiencesListCommand } from './commands/audiences/list'
import { audiencesUpdateCommand } from './commands/audiences/update'
import { automationsAudienceRunsControlCommand } from './commands/automations/audience-runs/control'
import { automationsAudienceRunsListCommand } from './commands/automations/audience-runs/list'
import { automationsCreateCommand } from './commands/automations/create'
import { automationsDeleteCommand } from './commands/automations/delete'
import { automationsGetCommand } from './commands/automations/get'
import { automationsListCommand } from './commands/automations/list'
import { automationsPublishCommand } from './commands/automations/publish'
import { automationsRunCommand } from './commands/automations/run'
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
import { brandsCreateCommand } from './commands/brands/create'
import { brandsGetCommand } from './commands/brands/get'
import { brandsListCommand } from './commands/brands/list'
import { chatsGetCommand } from './commands/chats/get'
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
import { doctorCommand } from './commands/doctor'
import { domainsAddCommand } from './commands/domains/add'
import { domainsDeleteCommand } from './commands/domains/delete'
import { domainsGetCommand } from './commands/domains/get'
import { domainsHealthCommand } from './commands/domains/health'
import { domainsListCommand } from './commands/domains/list'
import { domainsUpdateCommand } from './commands/domains/update'
import { domainsVerifyCommand } from './commands/domains/verify'
import { emailsAuditAccessibilityCommand } from './commands/emails/audit-accessibility'
import { emailsCloneCommand } from './commands/emails/clone'
import { emailsCreateInboxPlacementTestCommand } from './commands/emails/create-inbox-placement-test'
import { emailsDeleteCommand } from './commands/emails/delete'
import { emailsEditCommand } from './commands/emails/edit'
import { emailsExportCommand } from './commands/emails/export'
import { emailsGenerateCommand } from './commands/emails/generate'
import { emailsGetCommand } from './commands/emails/get'
import { emailsGetInboxPlacementResultsCommand } from './commands/emails/get-inbox-placement-results'
import { emailsGroupsListCommand } from './commands/emails/groups/list'
import { emailsImportCommand } from './commands/emails/import'
import { emailsImportFigmaCommand } from './commands/emails/import-figma'
import { emailsListCommand } from './commands/emails/list'
import { emailsPreviewClientsCommand } from './commands/emails/preview-clients'
import { emailsRestoreCommand } from './commands/emails/restore'
import { emailsSendCommand } from './commands/emails/send'
import { fieldsCreateCommand } from './commands/fields/create'
import { fieldsDeleteCommand } from './commands/fields/delete'
import { fieldsListCommand } from './commands/fields/list'
import { healthCommand } from './commands/health'
import { loginCommand } from './commands/login'
import { logoutCommand } from './commands/logout'
import { sendsCancelCommand } from './commands/sends/cancel'
import { sendsPauseCommand } from './commands/sends/pause'
import { sendsResumeCommand } from './commands/sends/resume'
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
  emailsGroupsListCommand,
  emailsGetCommand,
  emailsGenerateCommand,
  emailsImportCommand,
  emailsImportFigmaCommand,
  emailsEditCommand,
  emailsCloneCommand,
  emailsRestoreCommand,
  emailsDeleteCommand,
  emailsExportCommand,
  emailsAuditAccessibilityCommand,
  emailsPreviewClientsCommand,
  emailsCreateInboxPlacementTestCommand,
  emailsGetInboxPlacementResultsCommand,
  emailsSendCommand,
  sendsCancelCommand,
  sendsPauseCommand,
  sendsResumeCommand,
  audiencesListCommand,
  audiencesGetCommand,
  audiencesCreateCommand,
  audiencesUpdateCommand,
  audiencesDuplicateCommand,
  audiencesFromEventsCommand,
  audiencesDeleteCommand,
  automationsListCommand,
  automationsGetCommand,
  automationsCreateCommand,
  automationsUpdateCommand,
  automationsPublishCommand,
  automationsUnpublishCommand,
  automationsDeleteCommand,
  automationsTestCommand,
  automationsRunCommand,
  automationsTriggersListCommand,
  automationsTriggersCreateCommand,
  automationsTriggersUpdateCommand,
  automationsTriggersDeleteCommand,
  automationsTriggersFireCommand,
  automationsRunsListCommand,
  automationsAudienceRunsListCommand,
  automationsAudienceRunsControlCommand,
  analyticsOverviewCommand,
  analyticsCampaignsCommand,
  analyticsAutomationsCommand,
  analyticsEventsCommand,
  analyticsSendsListCommand,
  analyticsSendsGetCommand,
  analyticsTriggerInstancesListCommand,
  brandGetCommand,
  brandUpdateCommand,
  brandGetImagesCommand,
  brandsListCommand,
  brandsGetCommand,
  brandsCreateCommand,
  domainsListCommand,
  domainsGetCommand,
  domainsAddCommand,
  domainsVerifyCommand,
  domainsHealthCommand,
  domainsUpdateCommand,
  domainsDeleteCommand,
  contentGenerateImageCommand,
  contentGifCommand,
  contentTransformCommand,
  contentHtmlToPngCommand,
  contentAddImageCommand,
  templatesListCommand,
  chatsGetCommand,
  healthCommand,
  usageCommand,
  doctorCommand,
  docsCommand,
  docsApiCommand,
  apiCommand,
]
