import { defineCommand } from '../../lib/define-command'

export const sendsCancelCommand = defineCommand({
  path: ['sends', 'cancel'],
  summary: 'Cancel a scheduled or queued send before it goes out',
  sdkMethod: 'sends.cancel',
  route: { method: 'POST', path: '/v1/sends/{sendId}/cancel' },
  commandClass: 'destructive',
  args: [{ name: 'sendId', summary: 'Send id to cancel', isRequired: true }],
  examples: ['brew-cli sends cancel snd_9f2kX --yes'],
  confirmSummary: ({ args }) =>
    `Cancel send ${args.sendId ?? ''}. A scheduled or queued campaign will not go out; delivery already in flight cannot be recalled.`,
  run: async ({ ctx, args }) => ({
    data: await ctx.client().sends.cancel(args.sendId ?? ''),
  }),
})
