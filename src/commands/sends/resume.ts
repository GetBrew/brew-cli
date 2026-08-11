import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { flagString, IDEMPOTENCY_FLAG } from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type SendResumeResponse = components['schemas']['SendResumeResponse']

export const sendsResumeCommand = defineCommand({
  path: ['sends', 'resume'],
  summary: 'Resume a paused gradual send (the unsent tail is re-spread)',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/sends/{sendId}/resume' },
  commandClass: 'write',
  args: [{ name: 'sendId', summary: 'Send id to resume', isRequired: true }],
  flags: [IDEMPOTENCY_FLAG],
  examples: ['brew-cli sends resume snd_123'],
  run: async ({ ctx, args, flags }) => ({
    data: await rawRequest<SendResumeResponse>(ctx, {
      method: 'POST',
      path: `/v1/sends/${encodeURIComponent(args.sendId ?? '')}/resume`,
      idempotencyKey: flagString(flags.idempotencyKey),
    }),
  }),
})
