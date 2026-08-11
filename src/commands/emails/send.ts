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
    'brew-cli emails send eml_1 --subject "Fall sale" --domain dom_1 --schedule-at 2026-09-01T09:00:00Z --yes',
  ],
  confirmSummary: ({ args, flags }) => {
    if (flags.test === true) {
      return
    }
    const audience = flagString(flags.audience)
    const scheduleAt = flagString(flags.scheduleAt)
    const target =
      audience === undefined ? 'its recipients' : `audience ${audience}`
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
