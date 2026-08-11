import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { flagString } from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type EmailInboxPlacementGetResponse =
  components['schemas']['EmailInboxPlacementGetResponse']

export const emailsGetInboxPlacementResultsCommand = defineCommand({
  path: ['emails', 'get-inbox-placement-results'],
  summary:
    'Inbox placement results: one test with --test-id, else the recent tests',
  sdkMethod: null,
  isRawTransport: true,
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
    data: await rawRequest<EmailInboxPlacementGetResponse>(ctx, {
      method: 'GET',
      path: `/v1/emails/${encodeURIComponent(args.emailId ?? '')}/inbox-placement-tests`,
      query: { testId: flagString(flags.testId) },
    }),
  }),
})
