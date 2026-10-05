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
    'Audit HTML, JSX, or a saved email for production readiness (5 credits when complete)',
  sdkMethod: 'emails.auditEmail',
  route: { method: 'POST', path: '/v1/emails/audit' },
  commandClass: 'write',
  defaultTimeoutMs: AUDIT_EMAIL_DEFAULT_TIMEOUT_MS,
  isCredited: true,
  flags: [
    {
      flag: '--file <path>',
      summary: 'Email HTML file to audit, or - for stdin',
    },
    {
      flag: '--jsx-file <path>',
      summary: 'React Email JSX file to audit, or - for stdin',
    },
    {
      flag: '--email-id <id>',
      summary: 'Saved email to audit (latest version by default)',
    },
    {
      flag: '--email-version-id <id>',
      summary: 'Saved email version ID; requires emailId',
    },
    { flag: '--subject <text>', summary: 'Inbox subject line' },
    {
      flag: '--preview-text <text>',
      summary: 'Inbox preview text; an explicit empty value stays empty',
    },
    {
      flag: '--sending-purpose <purpose>',
      summary:
        'marketing | transactional (omitted: inferred; marketing if unclear)',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli emails audit --file newsletter.html --subject "August update" --sending-purpose marketing',
    'cat email.html | brew-cli emails audit --file - --subject "Receipt" --sending-purpose transactional',
    `brew-cli emails audit --input '{"emailHtml":"<p>Hello</p>","subject":"Hello"}'`,
    'brew-cli emails audit --jsx-file newsletter.tsx',
    'brew-cli emails audit --email-id email_123 --email-version-id version_123',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const emailHtml = await readTextFlag(ctx, flags.file, '--file')
    const emailJsx = await readTextFlag(ctx, flags.jsxFile, '--jsx-file')
    const sendingPurpose = flagString(flags.sendingPurpose)
    if (sendingPurpose !== undefined && !SENDING_PURPOSES.has(sendingPurpose)) {
      throw new CliUsageError(
        `Unknown --sending-purpose '${sendingPurpose}' (expected marketing | transactional).`
      )
    }
    const input = mergeInput(base, {
      emailHtml,
      emailJsx,
      emailId: flagString(flags.emailId),
      emailVersionId: flagString(flags.emailVersionId),
      subject: optionalText(flags.subject),
      previewText: optionalText(flags.previewText),
      sendingPurpose,
    })
    const sources = ['emailHtml', 'emailJsx', 'emailId'].filter(
      (field) => input[field] !== undefined
    )
    const source = sources[0]
    const content = source === undefined ? undefined : input[source]
    if (
      sources.length !== 1 ||
      typeof content !== 'string' ||
      content.trim() === ''
    ) {
      throw new CliUsageError(
        'Choose exactly one nonblank source: --file, --jsx-file, --email-id, or emailHtml/emailJsx/emailId via --input.'
      )
    }
    if (input.emailVersionId !== undefined && source !== 'emailId') {
      throw new CliUsageError('emailVersionId requires a saved emailId.')
    }
    // The 65 s audit deadline is the command's `defaultTimeoutMs`: the
    // whole command, body read included, and `--timeout` overrides it.
    const result = await ctx
      .client()
      .emails.auditEmail(
        asSdkInput<AuditEmailInput>(input),
        requestOptions(flags)
      )
    return { data: result }
  },
})
