import type { BrewClient } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { asSdkInput, flagString } from '../../lib/input'

type GetInboxPlacementResultsInput = Parameters<
  BrewClient['emails']['getInboxPlacementResults']
>[0]

export const emailsGetInboxPlacementResultsCommand = defineCommand({
  path: ['emails', 'get-inbox-placement-results'],
  summary:
    'Inbox placement results: one test with --test-id, else the recent tests',
  sdkMethod: 'emails.getInboxPlacementResults',
  route: { method: 'GET', path: '/v1/emails/{emailId}/inbox-placement-tests' },
  commandClass: 'read',
  args: [
    {
      name: 'emailId',
      summary: 'Design id the tests ran on',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--test-id <id>',
      summary:
        'One test: live status + per-provider placement (re-poll ~30s until completed)',
    },
  ],
  examples: [
    'brew-cli emails get-inbox-placement-results eml_2SmZOWV3ZQ7W5x6g3m4p',
    'brew-cli emails get-inbox-placement-results eml_2SmZOWV3ZQ7W5x6g3m4p --test-id ibp_2f1c9d8a',
  ],
  run: async ({ ctx, args, flags }) => ({
    data: await ctx.client().emails.getInboxPlacementResults(
      asSdkInput<GetInboxPlacementResultsInput>({
        emailId: args.emailId ?? '',
        testId: flagString(flags.testId),
      })
    ),
  }),
})
