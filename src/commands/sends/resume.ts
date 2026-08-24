import { defineCommand } from '../../lib/define-command'
import { IDEMPOTENCY_FLAG, requestOptions } from '../../lib/input'

export const sendsResumeCommand = defineCommand({
  path: ['sends', 'resume'],
  summary: 'Resume a paused gradual send (the unsent tail is re-spread)',
  sdkMethod: 'sends.resume',
  route: { method: 'POST', path: '/v1/sends/{sendId}/resume' },
  commandClass: 'write',
  args: [{ name: 'sendId', summary: 'Send id to resume', isRequired: true }],
  flags: [IDEMPOTENCY_FLAG],
  examples: ['brew-cli sends resume snd_123'],
  run: async ({ ctx, args, flags }) => ({
    data: await ctx
      .client()
      .sends.resume(args.sendId ?? '', requestOptions(flags)),
  }),
})
