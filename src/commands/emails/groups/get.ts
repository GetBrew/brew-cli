import { defineCommand } from '../../../lib/define-command'

export const emailsGroupsGetCommand = defineCommand({
  path: ['emails', 'groups', 'get'],
  summary: 'Fetch one email group by id — the bare row',
  sdkMethod: 'emailGroups.get',
  route: { method: 'GET', path: '/v1/email-groups/{groupId}' },
  commandClass: 'read',
  args: [
    {
      name: 'groupId',
      summary: 'Group id (`grp_…`, or the literal `ungrouped`)',
      isRequired: true,
    },
  ],
  examples: [
    'brew-cli emails groups get grp_2f1c9d8a',
    'brew-cli emails groups get ungrouped',
  ],
  run: async ({ ctx, args }) => ({
    data: await ctx.client().emailGroups.get(args.groupId ?? ''),
  }),
})
