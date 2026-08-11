import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { flagString, IDEMPOTENCY_FLAG } from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type Audience = components['schemas']['Audience']

export const audiencesDuplicateCommand = defineCommand({
  path: ['audiences', 'duplicate'],
  summary: 'Copy an audience segment (the copy gets a "(copy)" name)',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/audiences/{audienceId}/duplicate' },
  commandClass: 'write',
  args: [
    {
      name: 'audienceId',
      summary: 'Audience id to duplicate',
      isRequired: true,
    },
  ],
  // The operation takes no request body — the API names the copy itself.
  flags: [IDEMPOTENCY_FLAG],
  examples: ['brew-cli audiences duplicate aud_3k9sQ'],
  run: async ({ ctx, args, flags }) => ({
    data: await rawRequest<Audience>(ctx, {
      method: 'POST',
      path: `/v1/audiences/${encodeURIComponent(args.audienceId ?? '')}/duplicate`,
      idempotencyKey: flagString(flags.idempotencyKey),
    }),
  }),
})
