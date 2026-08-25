import { defineCommand } from '../../lib/define-command'
import { IDEMPOTENCY_FLAG, requestOptions } from '../../lib/input'

export const sendsPauseCommand = defineCommand({
  path: ['sends', 'pause'],
  summary: 'Pause an in-flight or scheduled send (resumable)',
  sdkMethod: 'sends.pause',
  route: { method: 'POST', path: '/v1/sends/{sendId}/pause' },
  commandClass: 'write',
  args: [{ name: 'sendId', summary: 'Send id to pause', isRequired: true }],
  flags: [IDEMPOTENCY_FLAG],
  examples: ['brew-cli sends pause snd_123'],
  run: async ({ ctx, args, flags }) => ({
    data: await ctx
      .client()
      .sends.pause(args.sendId ?? '', requestOptions(flags)),
  }),
})
