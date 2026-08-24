import { defineCommand } from '../../lib/define-command'

export const chatsGetCommand = defineCommand({
  path: ['chats', 'get'],
  summary: 'Brand-scoped digest of a Brew chat (artifacts + transcript tail)',
  sdkMethod: 'chats.get',
  route: { method: 'GET', path: '/v1/chats/{chatId}' },
  commandClass: 'read',
  args: [
    {
      name: 'chatId',
      summary: 'Brew chat id (from the chat URL / the app)',
      isRequired: true,
    },
  ],
  examples: ['brew-cli chats get Hk2mZ8t9QbY3sW1vR0pLd'],
  run: async ({ ctx, args }) => ({
    data: await ctx.client().chats.get(args.chatId ?? ''),
  }),
})
