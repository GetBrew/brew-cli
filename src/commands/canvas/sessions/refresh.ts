import type { operations } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { rawRequest } from '../../../lib/raw-request'

type Session =
  operations['refreshCanvasSession']['responses'][200]['content']['application/json']

export const canvasSessionsRefreshCommand = defineCommand({
  path: ['canvas', 'sessions', 'refresh'],
  summary: 'Renew a canvas grant using its original issuing credential',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/canvas/sessions/{sessionId}/refresh' },
  commandClass: 'write',
  args: [{ name: 'sessionId', summary: 'Canvas session ID', isRequired: true }],
  examples: ['brew-cli canvas sessions refresh session_example'],
  run: async ({ ctx, args }) => {
    const result = await rawRequest<Session>(ctx, {
      method: 'POST',
      path: `/v1/canvas/sessions/${encodeURIComponent(args.sessionId ?? '')}/refresh`,
      idempotency: 'none',
    })
    return {
      data: result,
      human: `Refreshed canvas session ${result.sessionId}.`,
    }
  },
})
