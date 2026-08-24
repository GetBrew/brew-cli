import type { BrewClient } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  requestOptions,
} from '../../lib/input'

type CloneEmailInput = Parameters<BrewClient['emails']['clone']>[0]

export const emailsCloneCommand = defineCommand({
  path: ['emails', 'clone'],
  summary: 'Clone a design into a new one (exact snapshot copy, no AI)',
  sdkMethod: 'emails.clone',
  route: { method: 'POST', path: '/v1/emails/{emailId}/clone' },
  commandClass: 'write',
  args: [{ name: 'emailId', summary: 'Design id to clone', isRequired: true }],
  flags: [
    {
      flag: '--email-version-id <id>',
      summary: 'Exact source version to clone (default: latest)',
    },
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli emails clone eml_2SmZOWV3ZQ7W5x6g3m4p',
    'brew-cli emails clone eml_2SmZOWV3ZQ7W5x6g3m4p --email-version-id emv_9f2kX',
  ],
  run: async ({ ctx, args, flags }) => {
    const emailVersionId = flagString(flags.emailVersionId)
    return {
      data: await ctx.client().emails.clone(
        asSdkInput<CloneEmailInput>({
          emailId: args.emailId ?? '',
          ...(emailVersionId === undefined ? {} : { emailVersionId }),
        }),
        requestOptions(flags)
      ),
    }
  },
})
