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

const SOURCE_KEYS = ['emailHtml', 'emailJsx', 'emailId'] as const

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function hasContent(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

/** The API takes exactly one source; say which flags name it before a call. */
function assertOneSource(input: Readonly<Record<string, unknown>>): void {
  const named = SOURCE_KEYS.filter((key) => input[key] !== undefined)
  if (named.length > 1) {
    throw new CliUsageError(
      `Audit one source at a time (got ${named.join(' and ')}).`
    )
  }
  if (named.length === 0 || !hasContent(input[named[0] ?? 'emailHtml'])) {
    throw new CliUsageError(
      'Name the email to audit: --file (HTML), --jsx (React Email) or --email-id, or emailHtml / emailJsx / emailId via --input.'
    )
  }
  if (input.emailVersionId !== undefined && named[0] !== 'emailId') {
    throw new CliUsageError('--email-version-id needs --email-id.')
  }
}

export const emailsAuditCommand = defineCommand({
  path: ['emails', 'audit'],
  summary:
    'Audit HTML, React Email JSX or a saved design for production readiness (5 credits when complete)',
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
      flag: '--jsx <path>',
      summary: 'React Email JSX module to audit, or - for stdin',
    },
    {
      flag: '--email-id <id>',
      summary: 'Saved design to audit (its latest version)',
    },
    {
      flag: '--email-version-id <id>',
      summary: 'Exact saved-design version to audit (with --email-id)',
    },
    {
      flag: '--subject <text>',
      summary: 'Inbox subject line; omitted, it is not judged',
    },
    {
      flag: '--preview-text <text>',
      summary: 'Inbox preview text; an explicit empty value stays empty',
    },
    {
      flag: '--sending-purpose <purpose>',
      summary: 'marketing | transactional (omitted: the audit infers it)',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli emails audit --file newsletter.html --subject "August update" --sending-purpose marketing',
    'brew-cli emails audit --jsx emails/welcome.tsx --subject "Welcome aboard"',
    'brew-cli emails audit --email-id V1StGXR8_Z5jdHi6B-myT',
    'cat email.html | brew-cli emails audit --file - --subject "Receipt" --sending-purpose transactional',
    `brew-cli emails audit --input '{"emailHtml":"<p>Hello</p>","subject":"Hello"}'`,
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const emailHtml = await readTextFlag(ctx, flags.file, '--file')
    const emailJsx = await readTextFlag(ctx, flags.jsx, '--jsx')
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
    assertOneSource(input)
    // The SDK's audit deadline is the command's `defaultTimeoutMs`: the
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
