import {
  buildSdkClient,
  LOGIN_KEYS_URL,
  maskApiKey,
  resolveAuth,
} from '../lib/client'
import { updateConfig } from '../lib/config-store'
import { defineCommand } from '../lib/define-command'
import { CliUsageError } from '../lib/errors'
import { progress } from '../lib/output'
import type { CliContext } from '../lib/types'

const KEY_SHAPE = /^brew_[a-z0-9]{16,64}$/

export const loginCommand = defineCommand({
  path: ['login'],
  summary: 'Store an API key for this machine (validated against the API)',
  sdkMethod: null,
  commandClass: 'write',
  examples: [
    'brew-cli login',
    'brew-cli login --api-key brew_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    'echo "$BREW_API_KEY" | brew-cli login',
  ],
  run: async ({ ctx }) => {
    const candidate = await readCandidateKey(ctx)
    if (!KEY_SHAPE.test(candidate)) {
      progress(
        ctx,
        'Warning: key does not look like a Brew API key (brew_…); validating anyway.'
      )
    }
    const auth = resolveAuth({
      globals: { ...ctx.globals, apiKey: candidate },
      env: ctx.io.env,
    })
    // Throws a 401 BrewApiError (exit 3) when the key is invalid.
    await buildSdkClient(auth).usage.get()
    const path = updateConfig(ctx.io.env, { apiKey: candidate })
    progress(ctx, `Logged in. Key stored in ${path} (0600).`)
    return {
      data: {
        loggedIn: true,
        apiKey: maskApiKey(candidate),
        apiUrl: auth.apiUrl,
        configPath: path,
      },
    }
  },
})

async function readCandidateKey(ctx: CliContext): Promise<string> {
  if (ctx.globals.apiKey !== undefined) {
    return ctx.globals.apiKey
  }
  if (!ctx.io.isTtyIn) {
    const piped = (await ctx.io.readStdin()).trim()
    if (piped !== '') {
      return piped
    }
    throw new CliUsageError(
      `No key provided. Pass --api-key or pipe the key on stdin. Create keys at ${LOGIN_KEYS_URL}`
    )
  }
  progress(ctx, `Create an API key at ${LOGIN_KEYS_URL}`)
  const answer = (await ctx.io.readLine('Paste your API key: ')).trim()
  if (answer === '') {
    throw new CliUsageError('No key entered.')
  }
  return answer
}
