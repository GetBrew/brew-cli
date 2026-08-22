import type { components } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { rawRequest } from '../../../lib/raw-request'

type EmailGroupDeleteResponse =
  components['schemas']['EmailGroupDeleteResponse']

export const emailsGroupsDeleteCommand = defineCommand({
  path: ['emails', 'groups', 'delete'],
  summary: 'Delete an email folder (group); its emails move to Ungrouped',
  sdkMethod: null,
  isRawTransport: true,
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
    data: await rawRequest<EmailGroupDeleteResponse>(ctx, {
      method: 'DELETE',
      path: `/v1/email-groups/${encodeURIComponent(args.groupId ?? '')}`,
    }),
  }),
})
