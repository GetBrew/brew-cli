import {
  BrewApiError,
  type IntegrationConnection,
  type IntegrationConnectionProvider,
  type RequestOptions,
} from '@brew.new/sdk'
import type { BrewClient } from '../client'
import { CliApiError, CliUsageError } from '../errors'
import type { CliContext } from '../types'

/**
 * The hosted auth email hooks (`GET|PUT /v1/integrations/{provider}/
 * connection`, GetBrew/brew-v2#2169): the providers that hand an app's auth
 * emails to Brew once connected, through the SDK's `integrations.connect`
 * and `integrations.getConnection` (typescript-sdk 13.3.0).
 *
 * A signing secret is read from an environment variable or stdin, never
 * from argv (shell history, process lists, agent transcripts), and never
 * printed: error text names the variable, not its value.
 */

export const HOSTED_AUTH_PROVIDERS = [
  'supabase_auth',
  'clerk',
] as const satisfies readonly IntegrationConnectionProvider[]

export type HostedAuthProvider = (typeof HOSTED_AUTH_PROVIDERS)[number]

export function parseHostedAuthProvider(value: string): HostedAuthProvider {
  if ((HOSTED_AUTH_PROVIDERS as readonly string[]).includes(value)) {
    return value as HostedAuthProvider
  }
  throw new CliUsageError(
    `<provider> takes ${HOSTED_AUTH_PROVIDERS.join(' or ')}; got "${value}". Other integrations connect in Brew (Settings > Integrations).`
  )
}

/**
 * The shape each provider shows its secret in: Supabase's Send Email hook
 * `v1,whsec_<base64>`, a Clerk (Svix) endpoint `whsec_<base64>`. Checked
 * here so a pasted URL or API key is a usage error that never leaves the
 * machine; the API checks again.
 */
const SECRET_SHAPES: Readonly<Record<HostedAuthProvider, RegExp>> = {
  supabase_auth: /^v1,whsec_[A-Za-z0-9+/=]{16,}$/,
  clerk: /^whsec_[A-Za-z0-9+/=]{16,}$/,
}

const SECRET_HINTS: Readonly<Record<HostedAuthProvider, string>> = {
  supabase_auth:
    'a Supabase Send Email hook secret (v1,whsec_…, from Authentication > Hooks)',
  clerk:
    'a Clerk webhook signing secret (whsec_…, from Webhooks > your endpoint)',
}

export function checkSigningSecret(
  provider: HostedAuthProvider,
  secret: string,
  source: string
): string {
  const trimmed = secret.trim()
  if (trimmed === '') {
    throw new CliUsageError(`${source} is empty.`)
  }
  if (trimmed.length > 4096 || !SECRET_SHAPES[provider].test(trimmed)) {
    // Never quote the value: it may be a real secret pasted in the wrong place.
    throw new CliUsageError(
      `${source} does not look like ${SECRET_HINTS[provider]}.`
    )
  }
  return trimmed
}

/** `--signing-secret-env <VAR>` or `--signing-secret-stdin`, exactly one. */
export async function readSigningSecret(
  ctx: CliContext,
  provider: HostedAuthProvider,
  input: { readonly envName: string | undefined; readonly stdin: boolean }
): Promise<string> {
  if (input.envName !== undefined && input.stdin) {
    throw new CliUsageError(
      'Pass --signing-secret-env <VAR> or --signing-secret-stdin, not both.'
    )
  }
  if (input.envName !== undefined) {
    // A secret pasted where the NAME goes must not be echoed back.
    if (
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(input.envName) ||
      /^whsec_|^sk_|^sbp_/i.test(input.envName) ||
      input.envName.length > 64
    ) {
      throw new CliUsageError(
        `--signing-secret-env takes an environment variable NAME (e.g. SEND_EMAIL_HOOK_SECRET), not the secret.`
      )
    }
    const value = ctx.io.env[input.envName]
    if (value === undefined || value.trim() === '') {
      throw new CliUsageError(
        `${input.envName} is not set in this shell. Export the signing secret into it, then run the command again.`
      )
    }
    return checkSigningSecret(provider, value, input.envName)
  }
  if (input.stdin) {
    if (ctx.io.isTtyIn) {
      throw new CliUsageError(
        '--signing-secret-stdin reads a pipe (e.g. `printenv SECRET | …`), not the terminal.'
      )
    }
    return checkSigningSecret(provider, await ctx.io.readStdin(), 'stdin')
  }
  throw new CliUsageError(
    `The signing secret comes from --signing-secret-env <VAR> or --signing-secret-stdin (never a flag value): ${SECRET_HINTS[provider]}.`
  )
}

/**
 * `GET …/connection` (`integrations.getConnection`): the brand's
 * connection, or `null` when the provider is not connected (404).
 */
export async function findConnection(
  client: BrewClient,
  provider: HostedAuthProvider,
  options: RequestOptions = {}
): Promise<IntegrationConnection | null> {
  try {
    return await client.integrations.getConnection(provider, options)
  } catch (error) {
    if (
      (error instanceof BrewApiError || error instanceof CliApiError) &&
      error.status === 404
    ) {
      return null
    }
    throw error
  }
}
