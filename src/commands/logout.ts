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
    const hadKey = readConfig(ctx.io.env).apiKey !== undefined
    const path = updateConfig(ctx.io.env, { apiKey: undefined })
    progress(ctx, hadKey ? 'Logged out.' : 'No stored key found.')
    return { data: { loggedOut: true, hadKey, configPath: path } }
  },
})
