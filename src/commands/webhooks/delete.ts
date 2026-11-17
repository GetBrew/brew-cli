import { defineCommand } from '../../lib/define-command'

const route = { method: 'DELETE', path: '/v1/webhooks/{webhookId}' } as const

export const webhooksDeleteCommand = defineCommand({
  path: ['webhooks', 'delete'],
  summary: 'Delete a webhook endpoint and stop future deliveries',
  sdkMethod: 'webhooks.delete',
  route,
  commandClass: 'destructive',
  args: [
    { name: 'webhookId', summary: 'Webhook endpoint ID', isRequired: true },
  ],
  flags: [],
  examples: ['brew-cli webhooks delete ep_example --yes'],
  confirmSummary: () =>
    'Delete the webhook endpoint and stop its pending deliveries.',
  run: async ({ ctx, args }) => ({
    data: await ctx.client().webhooks.delete(args.webhookId ?? ''),
  }),
})
