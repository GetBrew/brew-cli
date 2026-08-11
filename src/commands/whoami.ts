import { maskApiKey, resolveAuth } from '../lib/client'
import { defineCommand } from '../lib/define-command'

export const whoamiCommand = defineCommand({
  path: ['whoami'],
  summary: 'Show the resolved credential, brand, and API target',
  sdkMethod: null,
  commandClass: 'read',
  examples: ['brew-cli whoami', 'brew-cli whoami --json'],
  run: async ({ ctx }) => {
    const auth = resolveAuth({ globals: ctx.globals, env: ctx.io.env })
    const usage = await ctx.client().usage.get()
    return {
      data: {
        apiUrl: auth.apiUrl,
        apiKey: maskApiKey(auth.apiKey),
        apiKeySource: auth.apiKeySource,
        brandId: auth.brandId ?? null,
        usage,
      },
    }
  },
})
