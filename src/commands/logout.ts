import { deletePendingLogin } from '../lib/auth-flow/pending'
import { readConfig, updateConfig } from '../lib/config-store'
import { defineCommand } from '../lib/define-command'
import { progress } from '../lib/output'

export const logoutCommand = defineCommand({
  path: ['logout'],
  summary: 'Remove the stored API key from this machine',
  sdkMethod: null,
  commandClass: 'write',
  examples: ['brew-cli logout'],
  run: async ({ ctx }) => {
    const stored = readConfig(ctx.io.env)
    const hadKey = stored.apiKey !== undefined
    const path = updateConfig(ctx.io.env, {
      apiKey: undefined,
      userEmail: undefined,
      brandName: undefined,
      // A brand id a browser sign-in stored belongs to the removed key; one
      // set by hand (`config set brandId`) stays.
      ...(stored.brandName !== undefined ? { brandId: undefined } : {}),
    })
    // A browser sign-in still waiting to be resumed would sign back in.
    deletePendingLogin(ctx.io.env)
    progress(ctx, hadKey ? 'Logged out.' : 'No stored key found.')
    return { data: { loggedOut: true, hadKey, configPath: path } }
  },
})
