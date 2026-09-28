import type { BrewClient } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  requestOptions,
} from '../../lib/input'

type ExportEmailInput = Parameters<BrewClient['emails']['export']>[0]

export const emailsExportCommand = defineCommand({
  path: ['emails', 'export'],
  summary: 'Export a design to a connected ESP as a template (not a send)',
  sdkMethod: 'emails.export',
  route: { method: 'POST', path: '/v1/emails/{emailId}/export' },
  commandClass: 'write',
  args: [{ name: 'emailId', summary: 'Design id to export', isRequired: true }],
  flags: [
    {
      flag: '--provider <provider>',
      summary:
        'Connected ESP: braze, brevo, hubspot, klaviyo, mailchimp, mailjet, iterable, postmark, onesignal, mailgun, sendgrid',
    },
    {
      flag: '--template-name <name>',
      summary: 'Template name in the ESP (default: the email title)',
    },
    {
      flag: '--sender-email <email>',
      summary:
        'Brevo or Mailjet: the active sender to use (omit when the account has exactly one)',
    },
    {
      flag: '--dry-run',
      summary:
        'Validate design, ownership, and ESP connection without creating a template',
    },
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli emails export eml_2SmZOWV3ZQ7W5x6g3m4p --provider klaviyo',
    'brew-cli emails export eml_2SmZOWV3ZQ7W5x6g3m4p --provider mailchimp --template-name "Fall sale" --dry-run',
  ],
  run: async ({ ctx, args, flags }) => {
    const provider = flagString(flags.provider)
    if (provider === undefined) {
      throw new CliUsageError(
        '--provider is required: braze, brevo, hubspot, klaviyo, mailchimp, mailjet, iterable, postmark, onesignal, mailgun, or sendgrid.'
      )
    }
    const templateName = flagString(flags.templateName)
    const senderEmail = flagString(flags.senderEmail)
    return {
      data: await ctx.client().emails.export(
        asSdkInput<ExportEmailInput>({
          emailId: args.emailId ?? '',
          provider,
          ...(templateName === undefined ? {} : { templateName }),
          ...(senderEmail === undefined ? {} : { senderEmail }),
          // The spec field is snake_case, unlike the rest of the API surface.
          ...(flags.dryRun === true ? { dryRun: true } : {}),
        }),
        requestOptions(flags)
      ),
    }
  },
})
