import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import { flagString, IDEMPOTENCY_FLAG } from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type EmailExportResponse = components['schemas']['EmailExportResponse']

export const emailsExportCommand = defineCommand({
  path: ['emails', 'export'],
  summary: 'Export a design to a connected ESP as a template (not a send)',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/emails/{emailId}/export' },
  commandClass: 'write',
  args: [{ name: 'emailId', summary: 'Design id to export', isRequired: true }],
  flags: [
    {
      flag: '--provider <provider>',
      summary:
        'Connected ESP: braze, hubspot, klaviyo, mailchimp, iterable, postmark, onesignal, mailgun, sendgrid',
    },
    {
      flag: '--template-name <name>',
      summary: 'Template name in the ESP (default: the email title)',
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
        '--provider is required: braze, hubspot, klaviyo, mailchimp, iterable, postmark, onesignal, mailgun, or sendgrid.'
      )
    }
    const templateName = flagString(flags.templateName)
    return {
      data: await rawRequest<EmailExportResponse>(ctx, {
        method: 'POST',
        path: `/v1/emails/${encodeURIComponent(args.emailId ?? '')}/export`,
        body: {
          provider,
          ...(templateName === undefined ? {} : { templateName }),
          // The spec field is snake_case, unlike the rest of the API surface.
          ...(flags.dryRun === true ? { dry_run: true } : {}),
        },
        idempotencyKey: flagString(flags.idempotencyKey),
      }),
    }
  },
})
