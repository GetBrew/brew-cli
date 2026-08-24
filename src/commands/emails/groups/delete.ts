import type { DeleteEmailGroupInput } from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import { asSdkInput } from '../../../lib/input'

export const emailsGroupsDeleteCommand = defineCommand({
  path: ['emails', 'groups', 'delete'],
  summary: 'Delete an email folder (group); its emails move to Ungrouped',
  sdkMethod: 'emailGroups.delete',
  route: { method: 'DELETE', path: '/v1/email-groups/{groupId}' },
  commandClass: 'destructive',
  args: [
    {
      name: 'groupId',
      summary: 'Named group id (grp_*); Ungrouped cannot be deleted',
      isRequired: true,
    },
  ],
  examples: ['brew-cli emails groups delete grp_welcome --yes'],
  confirmSummary: ({ args }) =>
    `Delete email group ${args.groupId ?? ''}. Its emails move to Ungrouped; the folder itself cannot be recovered.`,
  run: async ({ ctx, args }) => ({
    data: await ctx
      .client()
      .emailGroups.delete(
        asSdkInput<DeleteEmailGroupInput>({ groupId: args.groupId ?? '' })
      ),
  }),
})
