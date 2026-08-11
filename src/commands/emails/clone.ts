import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { flagString, IDEMPOTENCY_FLAG } from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type EmailCloneResponse =
  components['schemas']['EmailGenerateGeneratedResponse']

export const emailsCloneCommand = defineCommand({
  path: ['emails', 'clone'],
  summary: 'Clone a design into a new one (exact snapshot copy, no AI)',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/emails/{emailId}/clone' },
  commandClass: 'write',
  args: [{ name: 'emailId', summary: 'Design id to clone', isRequired: true }],
  flags: [
    {
      flag: '--email-version-id <id>',
      summary: 'Exact source version to clone (default: latest)',
    },
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli emails clone eml_2SmZOWV3ZQ7W5x6g3m4p',
    'brew-cli emails clone eml_2SmZOWV3ZQ7W5x6g3m4p --email-version-id emv_9f2kX',
  ],
  run: async ({ ctx, args, flags }) => {
    const emailVersionId = flagString(flags.emailVersionId)
    return {
      data: await rawRequest<EmailCloneResponse>(ctx, {
        method: 'POST',
        path: `/v1/emails/${encodeURIComponent(args.emailId ?? '')}/clone`,
        // The body is optional; omit it entirely to clone the latest version.
        ...(emailVersionId === undefined ? {} : { body: { emailVersionId } }),
        idempotencyKey: flagString(flags.idempotencyKey),
      }),
    }
  },
})
