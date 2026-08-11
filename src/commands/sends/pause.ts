import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { flagString, IDEMPOTENCY_FLAG } from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type SendPauseResponse = components['schemas']['SendPauseResponse']

export const sendsPauseCommand = defineCommand({
  path: ['sends', 'pause'],
  summary: 'Pause an in-flight or scheduled send (resumable)',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/sends/{sendId}/pause' },
  commandClass: 'write',
  args: [{ name: 'sendId', summary: 'Send id to pause', isRequired: true }],
  flags: [IDEMPOTENCY_FLAG],
  examples: ['brew-cli sends pause snd_123'],
  run: async ({ ctx, args, flags }) => ({
    data: await rawRequest<SendPauseResponse>(ctx, {
      method: 'POST',
      path: `/v1/sends/${encodeURIComponent(args.sendId ?? '')}/pause`,
      idempotencyKey: flagString(flags.idempotencyKey),
    }),
  }),
})
