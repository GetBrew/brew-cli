import { defineCommand } from '../../../lib/define-command'

export const emailsInboxPlacementTestsGetCommand = defineCommand({
  path: ['emails', 'inbox-placement-tests', 'get'],
  summary:
    'Fetch one inbox-placement (seed) test — the bare row, re-poll ~30s until completed',
  sdkMethod: 'emails.inboxPlacementTests.get',
  route: {
    method: 'GET',
    path: '/v1/emails/{emailId}/inbox-placement-tests/{testId}',
  },
  commandClass: 'read',
  args: [
    {
      name: 'emailId',
      summary: 'Design id the test ran on',
      isRequired: true,
    },
    {
      name: 'testId',
      summary: 'Test id returned by `emails create-inbox-placement-test`',
      isRequired: true,
    },
  ],
  examples: [
    'brew-cli emails inbox-placement-tests get eml_2SmZOWV3ZQ7W5x6g3m4p ibp_2f1c9d8a',
  ],
  run: async ({ ctx, args }) => ({
    data: await ctx
      .client()
      .emails.inboxPlacementTests.get(args.emailId ?? '', args.testId ?? ''),
  }),
})
