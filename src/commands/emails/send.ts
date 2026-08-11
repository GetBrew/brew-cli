import type { SendEmailInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  requestOptions,
  toStringArray,
} from '../../lib/input'

export const emailsSendCommand = defineCommand({
  path: ['emails', 'send'],
  summary: 'Send an email: a real campaign, or a safe test with --test',
  sdkMethod: 'emails.send',
  route: { method: 'POST', path: '/v1/sends' },
  commandClass: 'destructive',
  args: [{ name: 'emailId', summary: 'Design id to send', isRequired: true }],
  flags: [
    {
      flag: '--test',
      summary: 'Test delivery to --to only; skips the confirmation gate',
    },
    {
      flag: '--to <emails...>',
      summary: 'Recipient(s): required for --test, ad-hoc list for campaigns',
    },
    { flag: '--subject <text>', summary: 'Subject line' },
    { flag: '--audience <audienceId>', summary: 'Campaign audience segment' },
    { flag: '--domain <domainId>', summary: 'Verified sending domain id' },
    {
      flag: '--schedule-at <iso>',
      summary: 'Schedule the campaign for an ISO-8601 time (default: now)',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli emails send eml_1 --test --to qa@example.com --subject "Preview"',
    'brew-cli emails send eml_1 --subject "Fall sale" --domain dom_1 --audience aud_1 --yes',
    'brew-cli emails send eml_1 --subject "Fall sale" --domain dom_1 --audience aud_1 --schedule-at 2026-09-01T09:00:00Z --yes',
  ],
  confirmSummary: ({ args, flags }) => {
    // The gate must describe the MERGED send, not just the flags — an
    // --input body can carry test/audienceId/to/scheduledAt on its own.
    const inline = parseInlineInput(flags.input)
    const isTest = flags.test === true || inline?.test === true
    if (isTest) {
      return
    }
    const audience = flagString(flags.audience) ?? asString(inline?.audienceId)
    const scheduleAt =
      flagString(flags.scheduleAt) ?? asString(inline?.scheduledAt)
    const recipients = toStringArray(flags.to) ?? asRecipients(inline?.to)
    const target =
      audience === undefined
        ? recipients === undefined
          ? flags.input === '-'
            ? 'the recipients named in the --input body on stdin'
            : 'its recipients'
          : `${recipients.length} listed recipient(s)`
        : `audience ${audience}`
    const timing = scheduleAt === undefined ? 'now' : `at ${scheduleAt}`
    return `Send email ${args.emailId ?? ''} as a REAL campaign to ${target} ${timing}. Real recipients receive it; this cannot be undone.`
  },
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      emailId: args.emailId,
      test: flags.test === true ? true : undefined,
      subject: flagString(flags.subject),
      to: collapseRecipients(toStringArray(flags.to)),
      audienceId: flagString(flags.audience),
      domainId: flagString(flags.domain),
      scheduledAt: flagString(flags.scheduleAt),
    })
    if (typeof input.subject !== 'string' || input.subject === '') {
      throw new CliUsageError(
        '--subject is required (or provide it via --input).'
      )
    }
    if (input.test === true && input.to === undefined) {
      throw new CliUsageError('--to is required for a --test send.')
    }
    if (input.test !== true && typeof input.domainId !== 'string') {
      throw new CliUsageError(
        'Campaign sends require --domain (a verified domain id); use --test for a test delivery.'
      )
    }
    const result = await ctx
      .client()
      .emails.send(asSdkInput<SendEmailInput>(input), requestOptions(flags))
    return { data: result }
  },
})

function collapseRecipients(
  values: readonly string[] | undefined
): string | readonly string[] | undefined {
  if (values === undefined) {
    return
  }
  const [first] = values
  return values.length === 1 && first !== undefined ? first : values
}

/** Best-effort parse of an inline --input body (stdin `-` stays opaque). */
function parseInlineInput(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'string' || value === '-') {
    return
  }
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed !== null && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : undefined
  } catch {}
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function asRecipients(value: unknown): readonly string[] | undefined {
  if (typeof value === 'string' && value !== '') {
    return [value]
  }
  if (Array.isArray(value)) {
    const items = value.filter(
      (item): item is string => typeof item === 'string'
    )
    return items.length > 0 ? items : undefined
  }
}
