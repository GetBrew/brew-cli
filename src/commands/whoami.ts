import { BrewApiError } from '@brew.new/sdk'
import { maskApiKey, resolveAuth } from '../lib/client'
import { readConfig } from '../lib/config-store'
import { defineCommand } from '../lib/define-command'
import { progress } from '../lib/output'

export const whoamiCommand = defineCommand({
  path: ['whoami'],
  summary:
    'Show the resolved credential, brand, API target, and who approved a browser sign-in',
  sdkMethod: null,
  commandClass: 'read',
  examples: ['brew-cli whoami', 'brew-cli whoami --json'],
  run: async ({ ctx }) => {
    const auth = resolveAuth({ globals: ctx.globals, env: ctx.io.env })
    // Invalid credentials must surface (exit 3), but a server-side outage
    // should not hide the local credential state — degrade to usage: null.
    let usage: unknown = null
    try {
      usage = await ctx.client().usage.get()
    } catch (error) {
      if (
        error instanceof BrewApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        throw error
      }
      // Ctrl-C, SIGTERM or the command's own --timeout stops it: none of
      // them is an outage to degrade around.
      ctx.signal.throwIfAborted()
      progress(
        ctx,
        'Warning: could not reach /v1/usage — showing local credential state only.'
      )
    }
    // Who approved the stored key's browser sign-in: it describes that key
    // only, never one from --api-key or BREW_API_KEY.
    const stored =
      auth.apiKeySource === 'config' ? readConfig(ctx.io.env) : undefined
    return {
      data: {
        apiUrl: auth.apiUrl,
        apiKey: maskApiKey(auth.apiKey),
        apiKeySource: auth.apiKeySource,
        brandId: auth.brandId ?? null,
        userEmail: stored?.userEmail ?? null,
        brandName: stored?.brandName ?? null,
        usage,
      },
    }
  },
})
