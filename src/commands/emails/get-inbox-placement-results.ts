import type { ListInboxPlacementTestsInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import {
  asSdkInput,
  flagInt,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'
import { CURSOR_FLAG, LIMIT_FLAG } from '../../lib/paginate'

export const emailsGetInboxPlacementResultsCommand = defineCommand({
  path: ['emails', 'get-inbox-placement-results'],
  summary:
    'Inbox placement results: the recent tests, or one test with --test-id',
  sdkMethod: 'emails.inboxPlacementTests.list',
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
      // The list no longer filters by test id: --test-id reads the real
      // detail route, the same one `emails inbox-placement-tests get` binds.
      flag: '--test-id <id>',
      summary:
        'One test: live status + per-provider placement (re-poll ~30s until completed)',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli emails get-inbox-placement-results eml_2SmZOWV3ZQ7W5x6g3m4p',
    'brew-cli emails get-inbox-placement-results eml_2SmZOWV3ZQ7W5x6g3m4p --test-id ibp_2f1c9d8a',
  ],
  run: async ({ ctx, args, flags }) => {
    const emailId = args.emailId ?? ''
    const testId = flagString(flags.testId)
    const inboxPlacementTests = ctx.client().emails.inboxPlacementTests
    if (testId !== undefined) {
      return { data: await inboxPlacementTests.get(emailId, testId) }
    }
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      emailId,
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    return {
      data: await inboxPlacementTests.list(
        asSdkInput<ListInboxPlacementTestsInput>(input)
      ),
    }
  },
})
