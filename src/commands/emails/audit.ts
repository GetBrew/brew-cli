import {
  AUDIT_EMAIL_DEFAULT_TIMEOUT_MS,
  type AuditEmailInput,
} from '@brew.new/sdk'
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

const SENDING_PURPOSES = new Set(['marketing', 'transactional'])

export { AUDIT_EMAIL_DEFAULT_TIMEOUT_MS }

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export const emailsAuditCommand = defineCommand({
  path: ['emails', 'audit'],
  summary:
    'Audit raw email content for production readiness (5 credits when complete)',
  sdkMethod: 'emails.auditEmail',
  route: { method: 'POST', path: '/v1/emails/audit' },
  commandClass: 'write',
  isCredited: true,
  flags: [
    {
      flag: '--file <path>',
      summary: 'Email HTML file to audit, or - for stdin',
    },
    { flag: '--subject <text>', summary: 'Inbox subject line' },
    {
      flag: '--preview-text <text>',
      summary: 'Inbox preview text; an explicit empty value stays empty',
    },
    {
      flag: '--sending-purpose <purpose>',
      summary: 'marketing | transactional (default: marketing)',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli emails audit --file newsletter.html --subject "August update" --sending-purpose marketing',
    'cat email.html | brew-cli emails audit --file - --subject "Receipt" --sending-purpose transactional',
    `brew-cli emails audit --input '{"emailHtml":"<p>Hello</p>","subject":"Hello"}'`,
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const emailHtml = await readTextFlag(ctx, flags.file, '--file')
    const sendingPurpose = flagString(flags.sendingPurpose)
    if (sendingPurpose !== undefined && !SENDING_PURPOSES.has(sendingPurpose)) {
      throw new CliUsageError(
        `Unknown --sending-purpose '${sendingPurpose}' (expected marketing | transactional).`
      )
    }
    const input = mergeInput(base, {
      emailHtml,
      subject: optionalText(flags.subject),
      previewText: optionalText(flags.previewText),
      sendingPurpose,
    })
    if (typeof input.emailHtml !== 'string' || input.emailHtml.trim() === '') {
      throw new CliUsageError(
        '--file is required (a path, or - for stdin), or emailHtml via --input.'
      )
    }
    const signal = AbortSignal.timeout(AUDIT_EMAIL_DEFAULT_TIMEOUT_MS)
    try {
      const result = await ctx
        .client()
        .emails.auditEmail(asSdkInput<AuditEmailInput>(input), {
          signal,
          ...(requestOptions(flags) ?? {}),
        })
      return { data: result }
    } catch (error) {
      if (signal.aborted) {
        throw signal.reason
      }
      throw error
    }
  },
})
