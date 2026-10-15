import type { operations } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { rawRequest } from '../../../lib/raw-request'

type RevokeResult =
  operations['revokeCanvasSession']['responses'][200]['content']['application/json']

export const canvasSessionsRevokeCommand = defineCommand({
  path: ['canvas', 'sessions', 'revoke'],
  summary: 'Revoke a canvas session and terminate its access',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'DELETE', path: '/v1/canvas/sessions/{sessionId}' },
  commandClass: 'destructive',
  args: [{ name: 'sessionId', summary: 'Canvas session ID', isRequired: true }],
  examples: ['brew-cli canvas sessions revoke session_example --yes'],
  confirmSummary: ({ args }) =>
    `Revoke canvas session ${args.sessionId} and end its active access`,
  run: async ({ ctx, args }) => {
    const result = await rawRequest<RevokeResult>(ctx, {
      method: 'DELETE',
      path: `/v1/canvas/sessions/${encodeURIComponent(args.sessionId ?? '')}`,
    })
    return { data: result, human: `Revoked canvas session ${args.sessionId}.` }
  },
})
