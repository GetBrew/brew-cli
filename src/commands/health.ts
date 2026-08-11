import { defineCommand } from '../lib/define-command'

export const healthCommand = defineCommand({
  path: ['health'],
  summary: 'Check Brew API liveness (no auth required)',
  sdkMethod: 'health.get',
  route: { method: 'GET', path: '/v1/health' },
  commandClass: 'read',
  examples: ['brew-cli health'],
  run: async ({ ctx }) => ({
    data: await ctx.client({ allowAnonymous: true }).health.get(),
  }),
})
