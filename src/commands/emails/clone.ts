import type { BrewClient } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
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
    {
      flag: '--title <title>',
      summary: 'Name for the clone (default: Copy of <source title>)',
    },
    {
      flag: '--group-id <groupId>',
      summary: 'File the clone under an existing group (grp_…), or ungrouped',
    },
    {
      flag: '--group-name <name>',
      summary:
        'File the clone under a group found (or created) by this name; not with --group-id',
    },
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli emails clone eml_2SmZOWV3ZQ7W5x6g3m4p',
    'brew-cli emails clone eml_2SmZOWV3ZQ7W5x6g3m4p --email-version-id emv_9f2kX',
    'brew-cli emails clone eml_2SmZOWV3ZQ7W5x6g3m4p --title "Fall sale (B)" --group-name "Fall campaign"',
  ],
  run: async ({ ctx, args, flags }) => {
    const emailVersionId = flagString(flags.emailVersionId)
    const title = flagString(flags.title)
    const groupId = flagString(flags.groupId)
    const groupName = flagString(flags.groupName)
    if (groupId !== undefined && groupName !== undefined) {
      throw new CliUsageError('Pass --group-id or --group-name, not both.')
    }
    return {
      data: await ctx.client().emails.clone(
        asSdkInput<CloneEmailInput>({
          emailId: args.emailId ?? '',
          ...(emailVersionId === undefined ? {} : { emailVersionId }),
          ...(title === undefined ? {} : { title }),
          ...(groupId === undefined ? {} : { groupId }),
          ...(groupName === undefined ? {} : { groupName }),
        }),
        requestOptions(flags)
      ),
    }
  },
})
