import type { CreateEmailGroupInput } from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  requestOptions,
} from '../../../lib/input'
import { EMAIL_IDS_FLAG, toEmailIds } from './email-ids'

export const emailsGroupsCreateCommand = defineCommand({
  path: ['emails', 'groups', 'create'],
  summary:
    'Create a named email folder (group), optionally moving designs into it',
  sdkMethod: 'emailGroups.create',
  route: { method: 'POST', path: '/v1/email-groups' },
  commandClass: 'write',
  flags: [
    {
      flag: '--name <name>',
      summary: 'Folder label, 1-60 chars (Ungrouped is reserved)',
    },
    EMAIL_IDS_FLAG,
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli emails groups create --name Welcome',
    'brew-cli emails groups create --name Launches --email-ids eml_1,eml_2',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      name: flagString(flags.name),
      emailIds: toEmailIds(flagString(flags.emailIds)),
    })
    if (typeof input.name !== 'string' || input.name === '') {
      throw new CliUsageError('--name is required (or provide it via --input).')
    }
    return {
      data: await ctx
        .client()
        .emailGroups.create(
          asSdkInput<CreateEmailGroupInput>(input),
          requestOptions(flags)
        ),
    }
  },
})
