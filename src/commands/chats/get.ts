import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { rawRequest } from '../../lib/raw-request'

/** The spec inlines this response; there is no named component schema. */
type ChatContextResponse =
  operations['getChatContext']['responses'][200]['content']['application/json']

export const chatsGetCommand = defineCommand({
  path: ['chats', 'get'],
  summary: 'Brand-scoped digest of a Brew chat (artifacts + transcript tail)',
  sdkMethod: null,
  isRawTransport: true,
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
    data: await rawRequest<ChatContextResponse>(ctx, {
      method: 'GET',
      path: `/v1/chats/${encodeURIComponent(args.chatId ?? '')}`,
    }),
  }),
})
