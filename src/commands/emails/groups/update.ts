import type { UpdateEmailGroupInput } from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import {
  asSdkInput,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../../lib/input'
import { EMAIL_IDS_FLAG, toEmailIds } from './email-ids'

export const emailsGroupsUpdateCommand = defineCommand({
  path: ['emails', 'groups', 'update'],
  summary: 'Rename an email folder (group), move designs into it, or both',
  sdkMethod: 'emailGroups.update',
  route: { method: 'PATCH', path: '/v1/email-groups/{groupId}' },
  commandClass: 'write',
  args: [
    {
      name: 'groupId',
      summary: 'Named group id (grp_*); Ungrouped cannot be renamed',
      isRequired: true,
    },
  ],
  flags: [
    { flag: '--name <name>', summary: 'New folder label, 1-60 chars' },
    EMAIL_IDS_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli emails groups update grp_welcome --name "Welcome series"',
    'brew-cli emails groups update grp_welcome --email-ids eml_1,eml_2',
  ],
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      name: flagString(flags.name),
      emailIds: toEmailIds(flagString(flags.emailIds)),
    })
    const hasName = typeof input.name === 'string' && input.name !== ''
    const hasEmailIds = Array.isArray(input.emailIds)
    if (!(hasName || hasEmailIds)) {
      throw new CliUsageError(
        'Pass --name, --email-ids, or both (or provide them via --input).'
      )
    }
    return {
      data: await ctx.client().emailGroups.update(
        asSdkInput<UpdateEmailGroupInput>({
          ...input,
          groupId: args.groupId ?? '',
        })
      ),
    }
  },
})
