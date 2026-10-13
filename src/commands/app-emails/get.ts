import { defineCommand } from '../../lib/define-command'
import { renderAppEmails } from './list'

export const appEmailsGetCommand = defineCommand({
  path: ['app-emails', 'get'],
  summary:
    'Fetch one app email by its trigger key (404 TRIGGER_KEY_NOT_FOUND when none is set up)',
  sdkMethod: 'appEmails.get',
  route: { method: 'GET', path: '/v1/app-emails/{triggerKey}' },
  commandClass: 'read',
  args: [
    {
      name: 'triggerKey',
      summary: 'Trigger key, e.g. auth.password-reset',
      isRequired: true,
    },
  ],
  examples: [
    'brew-cli app-emails get auth.password-reset',
    'brew-cli app-emails get order.paid --json',
  ],
  run: async ({ ctx, args }) => {
    const row = await ctx.client().appEmails.get(args.triggerKey ?? '')
    return { data: row, human: renderAppEmails([row]) }
  },
})
