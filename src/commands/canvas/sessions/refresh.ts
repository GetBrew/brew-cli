import { defineCommand } from '../../../lib/define-command'

export const canvasSessionsRefreshCommand = defineCommand({
  path: ['canvas', 'sessions', 'refresh'],
  summary: 'Renew a canvas grant using its original issuing credential',
  sdkMethod: 'canvas.sessions.refresh',
  route: { method: 'POST', path: '/v1/canvas/sessions/{sessionId}/refresh' },
  commandClass: 'write',
  args: [{ name: 'sessionId', summary: 'Canvas session ID', isRequired: true }],
  examples: ['brew-cli canvas sessions refresh session_example'],
  run: async ({ ctx, args }) => {
    const result = await ctx
      .client()
      .canvas.sessions.refresh(args.sessionId ?? '')
    return { data: result }
  },
})
