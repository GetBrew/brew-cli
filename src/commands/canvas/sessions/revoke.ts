import { defineCommand } from '../../../lib/define-command'

export const canvasSessionsRevokeCommand = defineCommand({
  path: ['canvas', 'sessions', 'revoke'],
  summary: 'Revoke a canvas session and terminate its access',
  sdkMethod: 'canvas.sessions.revoke',
  route: { method: 'DELETE', path: '/v1/canvas/sessions/{sessionId}' },
  commandClass: 'destructive',
  args: [{ name: 'sessionId', summary: 'Canvas session ID', isRequired: true }],
  examples: ['brew-cli canvas sessions revoke session_example --yes'],
  confirmSummary: ({ args }) =>
    `Revoke canvas session ${args.sessionId} and end its active access`,
  run: async ({ ctx, args }) => {
    const result = await ctx
      .client()
      .canvas.sessions.revoke(args.sessionId ?? '')
    return { data: result, human: `Revoked canvas session ${args.sessionId}.` }
  },
})
