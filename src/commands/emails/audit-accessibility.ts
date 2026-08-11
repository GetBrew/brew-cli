import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { flagString, IDEMPOTENCY_FLAG } from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type EmailAccessibilityAuditResponse =
  components['schemas']['EmailAccessibilityAuditResponse']

export const emailsAuditAccessibilityCommand = defineCommand({
  path: ['emails', 'audit-accessibility'],
  summary: 'WCAG 2.1 audit of the latest rendered HTML (5 credits)',
  sdkMethod: null,
  isRawTransport: true,
  // SDK 8.0.0 issues GET for this operation; the spec (and the API) require
  // POST, which is why this command stays on the raw transport.
  route: { method: 'POST', path: '/v1/emails/{emailId}/accessibility-audit' },
  commandClass: 'write',
  isCredited: true,
  args: [{ name: 'emailId', summary: 'Design id to audit', isRequired: true }],
  flags: [IDEMPOTENCY_FLAG],
  examples: ['brew-cli emails audit-accessibility eml_2SmZOWV3ZQ7W5x6g3m4p'],
  run: async ({ ctx, args, flags }) => ({
    data: await rawRequest<EmailAccessibilityAuditResponse>(ctx, {
      method: 'POST',
      path: `/v1/emails/${encodeURIComponent(args.emailId ?? '')}/accessibility-audit`,
      idempotencyKey: flagString(flags.idempotencyKey),
    }),
  }),
})
