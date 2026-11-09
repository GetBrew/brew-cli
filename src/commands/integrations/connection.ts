import { defineCommand } from '../../lib/define-command'
import { parseHostedAuthProvider } from '../../lib/integrations/hosted-auth'

export const integrationsConnectionCommand = defineCommand({
  path: ['integrations', 'connection'],
  summary:
    "Show a hosted auth email hook's connection: webhook URL and status (pending_verification until the first signed delivery, then active)",
  sdkMethod: 'integrations.getConnection',
  route: { method: 'GET', path: '/v1/integrations/{provider}/connection' },
  commandClass: 'read',
  args: [
    {
      name: 'provider',
      summary: 'supabase_auth or clerk',
      isRequired: true,
    },
  ],
  examples: [
    'brew-cli integrations connection supabase_auth',
    'brew-cli integrations connection clerk --json',
  ],
  run: async ({ ctx, args }) => {
    const provider = parseHostedAuthProvider(args.provider ?? '')
    const connection = await ctx.client().integrations.getConnection(provider)
    return {
      data: connection,
      human: [
        `${connection.provider}: ${connection.status}`,
        `Webhook URL:   ${connection.webhookUrl}`,
        `Connection id: ${connection.connectionId}`,
      ].join('\n'),
    }
  },
})
