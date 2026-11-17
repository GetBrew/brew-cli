import { defineCommand } from '../../lib/define-command'

const route = { method: 'GET', path: '/v1/webhooks/{webhookId}' } as const

export const webhooksGetCommand = defineCommand({
  path: ['webhooks', 'get'],
  summary: 'Get a webhook endpoint without revealing its signing secret',
  sdkMethod: 'webhooks.get',
  route,
  commandClass: 'read',
  args: [
    { name: 'webhookId', summary: 'Webhook endpoint ID', isRequired: true },
  ],
  flags: [],
  examples: ['brew-cli webhooks get ep_example'],
  run: async ({ ctx, args }) => ({
    data: await ctx.client().webhooks.get(args.webhookId ?? ''),
  }),
})
