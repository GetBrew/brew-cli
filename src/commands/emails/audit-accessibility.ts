import { defineCommand } from '../../lib/define-command'
import { IDEMPOTENCY_FLAG, requestOptions } from '../../lib/input'

export const emailsAuditAccessibilityCommand = defineCommand({
  path: ['emails', 'audit-accessibility'],
  summary: 'Audit the rendered email against WCAG 2.1 (score + issues)',
  sdkMethod: 'emails.auditAccessibility',
  // The public API route is POST; SDK 8.0.0 issues GET for this call.
  route: { method: 'POST', path: '/v1/emails/{emailId}/accessibility-audit' },
  commandClass: 'write',
  isCredited: true,
  args: [{ name: 'emailId', summary: 'Design id to audit', isRequired: true }],
  flags: [IDEMPOTENCY_FLAG],
  examples: ['brew-cli emails audit-accessibility eml_2SmZOWV3ZQ7W5x6g3m4p'],
  run: async ({ ctx, args, flags }) => ({
    data: await ctx
      .client()
      .emails.auditAccessibility(
        { emailId: args.emailId ?? '' },
        requestOptions(flags)
      ),
  }),
})
