import { defineCommand } from '../lib/define-command'

export const usageCommand = defineCommand({
  path: ['usage'],
  summary: 'Show plan, credit balance, and email-send quota',
  sdkMethod: 'usage.get',
  route: { method: 'GET', path: '/v1/usage' },
  commandClass: 'read',
  examples: ['brew-cli usage', 'brew-cli usage --json'],
  run: async ({ ctx }) => ({ data: await ctx.client().usage.get() }),
})
