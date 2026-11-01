import type {
  ConnectIntegrationInput,
  ConnectIntegrationResponse,
} from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import { flagString } from '../../lib/input'
import {
  checkSecretEnvName,
  type HostedAuthProvider,
  parseHostedAuthProvider,
  readSigningSecret,
} from '../../lib/integrations/hosted-auth'
import { getInvocationPrefix } from '../../lib/invocation'
import { CONNECT_INTEGRATION_TIMEOUT_MS } from '../../lib/long-running'
import { progress } from '../../lib/output'

const PROVIDER_ARG = {
  name: 'provider',
  summary:
    'supabase_auth (the Supabase Auth Send Email Hook) or clerk (Clerk webhooks: email.created)',
  isRequired: true,
} as const

/** Where the person pastes the webhook URL, per provider. */
const PASTE_URL: Readonly<Record<HostedAuthProvider, string>> = {
  supabase_auth:
    'In Supabase, set it as the Send Email hook URL (Authentication > Hooks), enable the hook and save.',
  clerk:
    'In the Clerk Dashboard, set it as the endpoint URL (Webhooks > your endpoint, subscribed to email.created) and save.',
}

function parseProjectUrl(value: unknown): string | undefined {
  const text = flagString(value)
  if (text === undefined) {
    return
  }
  try {
    const url = new URL(text)
    if (
      url.protocol === 'https:' &&
      url.username === '' &&
      text.length <= 2048
    ) {
      return text
    }
  } catch {
    // reported below
  }
  throw new CliUsageError(
    `--project-url takes your Supabase project's https URL (https://<ref>.supabase.co); got "${text}".`
  )
}

export const integrationsConnectCommand = defineCommand({
  path: ['integrations', 'connect'],
  summary:
    'Connect a hosted auth email hook (Supabase Send Email Hook, Clerk email.created) and set up its auth app emails; prints the webhook URL to paste into the provider',
  sdkMethod: 'integrations.connect',
  route: { method: 'PUT', path: '/v1/integrations/{provider}/connection' },
  commandClass: 'destructive',
  defaultTimeoutMs: CONNECT_INTEGRATION_TIMEOUT_MS,
  args: [PROVIDER_ARG],
  flags: [
    {
      flag: '--signing-secret-env <var>',
      summary:
        'Read the signing secret from this environment variable (never pass the secret itself)',
    },
    {
      flag: '--signing-secret-stdin',
      summary: 'Read the signing secret from stdin (a pipe)',
    },
    {
      flag: '--project-url <url>',
      summary:
        'supabase_auth only: the project URL confirmation links point at (https://<ref>.supabase.co); default: the one Supabase sends',
    },
  ],
  examples: [
    'brew-cli integrations connect supabase_auth --signing-secret-env SEND_EMAIL_HOOK_SECRET --project-url https://abcdefghijklmnopqrst.supabase.co --yes',
    'printenv CLERK_WEBHOOK_SIGNING_SECRET | brew-cli integrations connect clerk --signing-secret-stdin --yes --json',
  ],
  confirmSummary: ({ args, flags }) => {
    checkSecretEnvName(flagString(flags.signingSecretEnv))
    return `Connect ${args.provider ?? 'the provider'} for this brand: Brew verifies its deliveries with this signing secret (replacing any saved before, so deliveries signed with the old one stop working) and sets up its auth app emails.`
  },
  run: async ({ ctx, args, flags }) => {
    const provider = parseHostedAuthProvider(args.provider ?? '')
    const projectUrl = parseProjectUrl(flags.projectUrl)
    if (projectUrl !== undefined && provider !== 'supabase_auth') {
      throw new CliUsageError('--project-url is for supabase_auth only.')
    }
    const signingSecret = await readSigningSecret(ctx, provider, {
      envName: flagString(flags.signingSecretEnv),
      stdin: flags.signingSecretStdin === true,
    })
    const input: ConnectIntegrationInput = {
      provider,
      signingSecret,
      ...(projectUrl === undefined ? {} : { settings: { projectUrl } }),
    }
    progress(ctx, `Connecting ${provider} and setting up its auth emails…`)
    const result = await ctx.client().integrations.connect(input)
    // A key that failed to set up exits 1, as `app-emails kit` does.
    return {
      data: result,
      human: renderConnected(result, getInvocationPrefix(ctx.io.env)),
      ...(result.authEmails.some((email) => !email.ok) ? { exitCode: 1 } : {}),
    }
  },
})

function renderConnected(
  result: ConnectIntegrationResponse,
  prefix: string
): string {
  const failed = result.authEmails.filter((email) => !email.ok)
  const lines = [
    `Connected ${result.provider} (${result.status})`,
    `Webhook URL:   ${result.webhookUrl}`,
    `Connection id: ${result.connectionId}`,
    `Auth emails:   ${result.authEmails.length - failed.length} set up${failed.length === 0 ? '' : `, ${failed.length} failed: ${failed.map((email) => `${email.triggerKey} (${email.error?.code ?? 'error'})`).join(', ')} (connect again to finish them)`}`,
    '',
    PASTE_URL[result.provider],
    // Set up is not sending, and the response does not say which send.
    `\`${prefix} app-emails list\` shows which auth emails send: one unpublished in Brew stays off, and the sandbox reaches your team only.`,
  ]
  if (result.status !== 'active') {
    lines.push(
      `The connection turns active after the first signed delivery: \`${prefix} integrations connection ${result.provider}\` shows it.`
    )
  }
  return lines.join('\n')
}
