import type { BrewClient } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  requestOptions,
  toStringArray,
} from '../../lib/input'

type CreateInboxPlacementTestInput = Parameters<
  BrewClient['emails']['createInboxPlacementTest']
>[0]

export const emailsCreateInboxPlacementTestCommand = defineCommand({
  path: ['emails', 'create-inbox-placement-test'],
  summary:
    'Seed-test where the design lands (inbox vs spam) via a real small send (10 credits)',
  sdkMethod: 'emails.createInboxPlacementTest',
  route: { method: 'POST', path: '/v1/emails/{emailId}/inbox-placement-tests' },
  commandClass: 'write',
  isCredited: true,
  args: [{ name: 'emailId', summary: 'Design id to test', isRequired: true }],
  flags: [
    {
      flag: '--domain <domainId>',
      summary: 'Verified sending domain id the seed send goes out on',
    },
    {
      flag: '--subject <text>',
      summary: 'Seed-send subject (default: the email title)',
    },
    {
      flag: '--preview-text <text>',
      summary: 'Preheader override for this test',
    },
    {
      flag: '--email-version-id <id>',
      summary: 'Pin a specific design version (default: latest)',
    },
    {
      flag: '--providers <domains...>',
      summary:
        'Restrict seed mailbox providers, repeatable (e.g. gmail.com outlook.com)',
    },
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli emails create-inbox-placement-test eml_2SmZOWV3ZQ7W5x6g3m4p --domain kx7bkh53hasmfeh5kd7sqgykt187g8ww',
    'brew-cli emails create-inbox-placement-test eml_2SmZOWV3ZQ7W5x6g3m4p --domain kx7bkh53hasmfeh5kd7sqgykt187g8ww --subject "Variant B" --providers gmail.com outlook.com',
  ],
  run: async ({ ctx, args, flags }) => {
    const domainId = flagString(flags.domain)
    if (domainId === undefined) {
      throw new CliUsageError(
        '--domain is required (a verified sending domain id; see `brew-cli domains list`).'
      )
    }
    const subject = flagString(flags.subject)
    const previewText = flagString(flags.previewText)
    const emailVersionId = flagString(flags.emailVersionId)
    const providers = toStringArray(flags.providers)
    return {
      // The API answers 202 with a pending test (status: "collecting");
      // poll `emails get-inbox-placement-results --test-id` for the outcome.
      data: await ctx.client().emails.createInboxPlacementTest(
        asSdkInput<CreateInboxPlacementTestInput>({
          emailId: args.emailId ?? '',
          domainId,
          ...(subject === undefined ? {} : { subject }),
          ...(previewText === undefined ? {} : { previewText }),
          ...(emailVersionId === undefined ? {} : { emailVersionId }),
          ...(providers === undefined ? {} : { providers }),
        }),
        requestOptions(flags)
      ),
    }
  },
})
