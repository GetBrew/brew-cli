import { defineCommand } from '../../lib/define-command'

export const audiencesDeleteCommand = defineCommand({
  path: ['audiences', 'delete'],
  summary: 'Delete an audience segment (contacts are kept)',
  sdkMethod: 'audiences.delete',
  route: { method: 'DELETE', path: '/v1/audiences/{audienceId}' },
  commandClass: 'destructive',
  args: [
    { name: 'audienceId', summary: 'Audience id to delete', isRequired: true },
  ],
  examples: ['brew-cli audiences delete aud_3k9sQ --yes'],
  confirmSummary: ({ args }) =>
    `Delete audience ${args.audienceId ?? ''}. Contacts are kept; the segment definition is gone. This cannot be undone.`,
  run: async ({ ctx, args }) => ({
    data: await ctx
      .client()
      .audiences.delete({ audienceId: args.audienceId ?? '' }),
  }),
})
