import { BrewApiError } from '@brew.new/sdk'
import type { BrewClient } from '../../client'
import { CliApiError } from '../../errors'
import {
  findConnection,
  type HostedAuthProvider,
} from '../../integrations/hosted-auth'
import { progress } from '../../output'
import type { ProjectWriter } from '../../project/fs-writer'
import type { CliContext } from '../../types'
import type { InitStep, NextStep } from '../report'
import {
  CLERK_EMAIL_SLUG_KEYS,
  CLERK_EMAILS_DASHBOARD_URL,
  CLERK_SECRET_VARIABLE,
  clerkKeyId,
  clerkToggleUrl,
  readClerkDelivery,
  readClerkSecret,
  setClerkDelivery,
} from './clerk'
import {
  backupHookSecret,
  detectSupabaseRef,
  generateHookSecret,
  localValue,
  patchSendEmailHook,
  REDACTED_SECRET,
  readSendEmailHook,
  type SendEmailHookBody,
  type SendEmailHookConfig,
  SUPABASE_PREVIOUS_SECRETS_VARIABLE,
  SUPABASE_TOKEN_VARIABLE,
  savedHookSecret,
  supabaseAuthConfigUrl,
  supabaseHooksUrl,
  supabaseProjectUrl,
} from './supabase'

/**
 * `init`'s provider step: where the auth provider's own emails go.
 *
 * Nothing about a provider changes under a bare `--yes`. Pointing Supabase
 * Auth's Send Email hook at Brew takes `--configure-supabase`; turning off
 * Clerk's delivery takes `--configure-clerk`, and happens only once Brew's
 * Clerk connection is `active` (a signed delivery arrived), so no email is
 * ever dropped between the two. Before either change, the provider's
 * previous settings go into `brew.json#providerConfig` (no secrets) and
 * `init --rollback-provider` puts them back. Without the flags, the step
 * prints the manual steps. Provider tokens stay on this machine: they go
 * to api.supabase.com / api.clerk.com, never to Brew, and never into
 * output or `brew.json`.
 */

export type ProviderRequest = {
  readonly vendor: 'Brew' | 'Supabase' | 'Clerk'
  readonly method: 'PATCH' | 'POST' | 'PUT'
  readonly url: string
  /** The body, with every secret replaced by a placeholder. */
  readonly body: unknown
}

export type InitProvider = {
  readonly provider: HostedAuthProvider
  /**
   * `manual`: steps printed, nothing changed. `planned`: a dry run's plan.
   * `configured`: changed now. `unchanged`: already pointing at Brew.
   * `refused`: opted in, but a precondition (an active connection, a
   * token) is missing. `restored`: a rollback put the old settings back.
   */
  readonly action:
    | 'manual'
    | 'planned'
    | 'configured'
    | 'unchanged'
    | 'refused'
    | 'restored'
    | 'failed'
  readonly connection: {
    readonly connectionId: string
    readonly webhookUrl: string
    readonly status: string
  } | null
  /** Supabase only. */
  readonly projectRef?: string | null
  /** The settings before this run changed them (no secrets). */
  readonly previous?: unknown
  /** Clerk only: the email templates this run turns (or turned) off / on. */
  readonly templates?: readonly string[]
  /** Every mutating request made, or planned in a dry run. */
  readonly requests: readonly ProviderRequest[]
  readonly rollbackCommand: string | null
  readonly detail: string
}

export type SupabaseRollback = {
  readonly projectRef: string
  readonly savedAt: string
  readonly previous: SendEmailHookConfig
  /** The `.env.local` variable holding the replaced hook's secret. */
  readonly previousSecretsVariable?: string
}

export type ClerkRollback = {
  readonly savedAt: string
  /** `clerkKeyId` of the key whose instance init changed. */
  readonly keyId?: string
  /** Templates init turned off; a rollback turns them back on. */
  readonly templates: readonly string[]
}

export type ProviderConfig = {
  readonly supabase_auth?: SupabaseRollback
  readonly clerk?: ClerkRollback
  readonly [other: string]: unknown
}

export type ProviderStepInput = {
  readonly ctx: CliContext
  readonly root: string
  readonly stack: string
  readonly dryRun: boolean
  readonly configureSupabase: boolean
  readonly configureClerk: boolean
  readonly supabaseProject: string | undefined
  readonly client: BrewClient | undefined
  readonly writer: ProjectWriter
  readonly prefix: string
  /**
   * ` --brand <id> --api-url <url>` (either part, or empty): this run's
   * brand and server, where a follow-up command would resolve others.
   */
  readonly scope: string
  /** `<prefix> init`, with the run's `--app <dir>` and `scope`. */
  readonly init: string
  readonly providerConfig: ProviderConfig
  /**
   * Writes `brew.json` with this provider config now (before a change);
   * false when it was not written.
   */
  readonly persist: (config: ProviderConfig) => boolean
  readonly now: () => number
}

const NOT_SAVED =
  'left as it is: brew.json was not written, so --rollback-provider could not undo the change'

export type ProviderStepResult = {
  readonly step: InitStep | null
  readonly nextSteps: readonly NextStep[]
  readonly providers: readonly InitProvider[]
  readonly providerConfig: ProviderConfig
}

function describe(error: unknown): string {
  if (error instanceof BrewApiError || error instanceof CliApiError) {
    return `${error.code}: ${error.message}`
  }
  return error instanceof Error ? error.message : String(error)
}

/** 401/403 from Brew are the credential's; a stop is never a finding. */
function rethrowIfFatal(ctx: CliContext, error: unknown): void {
  ctx.signal.throwIfAborted()
  if (
    (error instanceof BrewApiError || error instanceof CliApiError) &&
    (error.status === 401 || error.status === 403)
  ) {
    throw error
  }
}

function connectionOf(
  connection: {
    readonly connectionId: string
    readonly webhookUrl: string
    readonly status: string
  } | null
): InitProvider['connection'] {
  return connection === null
    ? null
    : {
        connectionId: connection.connectionId,
        webhookUrl: connection.webhookUrl,
        status: connection.status,
      }
}

export async function runProviderStep(
  input: ProviderStepInput
): Promise<ProviderStepResult> {
  if (input.stack === 'supabase') {
    return await supabaseStep(input)
  }
  if (input.stack === 'clerk') {
    return await clerkStep(input)
  }
  return {
    step: null,
    nextSteps: [],
    providers: [],
    providerConfig: input.providerConfig,
  }
}

async function readConnection(
  input: ProviderStepInput,
  provider: HostedAuthProvider
): Promise<
  | { readonly ok: true; readonly connection: InitProvider['connection'] }
  | { readonly ok: false; readonly error: string }
> {
  if (input.client === undefined) {
    return { ok: true, connection: null }
  }
  try {
    return {
      ok: true,
      connection: connectionOf(await findConnection(input.client, provider)),
    }
  } catch (error) {
    rethrowIfFatal(input.ctx, error)
    return { ok: false, error: describe(error) }
  }
}

// ---------------------------------------------------------------- Supabase

async function supabaseStep(
  input: ProviderStepInput
): Promise<ProviderStepResult> {
  const { ctx, prefix } = input
  const nextSteps: NextStep[] = []
  const detected = detectSupabaseRef({
    root: input.root,
    env: ctx.io.env,
    flag: input.supabaseProject,
  })
  const ref = detected?.ref ?? null
  // A printed re-run keeps the project --supabase-project picked: without
  // it, the re-run detects the project again, maybe another one.
  const picked =
    input.supabaseProject === undefined
      ? ''
      : ` --supabase-project ${input.supabaseProject}`
  const read = await readConnection(input, 'supabase_auth')
  if (!read.ok) {
    return failed(input, 'supabase_auth', read.error, ref)
  }
  const connection = read.connection
  const manualSteps = (): void => {
    nextSteps.push(
      {
        id: 'connect-supabase-hook',
        actor: 'human',
        kind: 'open-url',
        url: supabaseHooksUrl(ref),
        title: `Hand Supabase's auth emails to Brew: in Supabase, add a Send Email hook (Authentication > Hooks, HTTPS) and generate its secret; put the secret in SEND_EMAIL_HOOK_SECRET and run \`${prefix} integrations connect supabase_auth${input.scope} --signing-secret-env SEND_EMAIL_HOOK_SECRET${ref === null ? '' : ` --project-url ${supabaseProjectUrl(ref)}`} --yes\`; paste the webhook URL it prints as the hook URL, enable the hook and save`,
        blocking: true,
      },
      {
        id: 'configure-supabase-hook',
        actor: 'agent',
        kind: 'run-command',
        command: `${input.init} --configure-supabase${ref === null ? ' --supabase-project <ref>' : picked} --yes`,
        title: `Or let init do it: with ${SUPABASE_TOKEN_VARIABLE} (a Supabase personal access token, supabase.com/dashboard/account/tokens) in the environment, init connects Brew and points the Send Email hook at it through the Management API, saving the old hook settings for --rollback-provider`,
        blocking: false,
      }
    )
  }
  if (!input.configureSupabase) {
    if (connection?.status === 'active') {
      return {
        step: {
          id: 'provider',
          status: 'done',
          detail: 'Supabase Send Email hook delivers to Brew (active)',
        },
        nextSteps,
        providers: [
          {
            provider: 'supabase_auth',
            action: 'unchanged',
            connection,
            projectRef: ref,
            requests: [],
            rollbackCommand: rollbackCommandFor(input),
            detail: 'connected and active',
          },
        ],
        providerConfig: input.providerConfig,
      }
    }
    manualSteps()
    return {
      step: {
        id: 'provider',
        status: 'skipped',
        detail:
          connection === null
            ? 'Supabase Send Email hook not connected (manual steps below, or --configure-supabase)'
            : `connected, ${connection.status}: set the Send Email hook URL in Supabase to ${connection.webhookUrl}`,
      },
      nextSteps,
      providers: [
        {
          provider: 'supabase_auth',
          action: 'manual',
          connection,
          projectRef: ref,
          requests: [],
          rollbackCommand: null,
          detail: 'manual steps printed',
        },
      ],
      providerConfig: input.providerConfig,
    }
  }

  // --configure-supabase
  if (ref === null) {
    nextSteps.push({
      id: 'supabase-project',
      actor: 'agent',
      kind: 'run-command',
      command: `${input.init} --configure-supabase --supabase-project <ref> --yes`,
      title:
        'Name the Supabase project: its ref is the <ref> in https://<ref>.supabase.co (or run `supabase link`)',
      blocking: true,
    })
    return refused(
      input,
      'supabase_auth',
      connection,
      null,
      'no Supabase project ref found',
      nextSteps
    )
  }
  const token = localValue(ctx, input.writer, SUPABASE_TOKEN_VARIABLE)
  if (token === undefined) {
    nextSteps.push({
      id: 'supabase-access-token',
      actor: 'human',
      kind: 'set-secret',
      url: 'https://supabase.com/dashboard/account/tokens',
      title: `Create a Supabase personal access token and export it as ${SUPABASE_TOKEN_VARIABLE} in this shell (it stays on this machine; Brew never sees it), then run init --configure-supabase again`,
      blocking: true,
    })
    return refused(
      input,
      'supabase_auth',
      connection,
      ref,
      `${SUPABASE_TOKEN_VARIABLE} is not set`,
      nextSteps
    )
  }
  if (input.client === undefined && !input.dryRun) {
    return refused(
      input,
      'supabase_auth',
      connection,
      ref,
      'no Brew credential',
      nextSteps
    )
  }
  let hook: Awaited<ReturnType<typeof readSendEmailHook>>
  try {
    hook = await readSendEmailHook(ctx, { ref, token })
  } catch (error) {
    ctx.signal.throwIfAborted()
    return failed(input, 'supabase_auth', describe(error), ref, connection)
  }
  if (
    connection !== null &&
    hook.config.hook_send_email_enabled &&
    hook.config.hook_send_email_uri === connection.webhookUrl
  ) {
    return {
      step: {
        id: 'provider',
        status: 'done',
        detail: `Supabase Send Email hook already delivers to Brew (${connection.status})`,
      },
      nextSteps,
      providers: [
        {
          provider: 'supabase_auth',
          action: 'unchanged',
          connection,
          projectRef: ref,
          previous: input.providerConfig.supabase_auth?.previous ?? null,
          requests: [],
          rollbackCommand: rollbackCommandFor(input),
          detail: 'already configured',
        },
      ],
      providerConfig: input.providerConfig,
    }
  }
  if (connection?.status === 'active') {
    // A hook that is not this project's verifies with the connection's
    // secret: a new one would stop that hook's emails.
    nextSteps.push({
      id: 'supabase-connection-in-use',
      actor: 'human',
      kind: 'open-url',
      url: supabaseHooksUrl(ref),
      title: `Brew's Supabase connection is active for a Send Email hook that is not project ${ref}'s. To move it here on purpose, run \`${prefix} integrations connect supabase_auth${input.scope}\` with a new secret and point every project's hook at ${connection.webhookUrl} with it`,
      blocking: true,
    })
    return refused(
      input,
      'supabase_auth',
      connection,
      ref,
      "hook left as it is: Brew's connection is active for another hook, which a new secret would stop",
      nextSteps
    )
  }
  const projectUrl = supabaseProjectUrl(ref)
  const webhookPlaceholder =
    connection?.webhookUrl ??
    '<webhookUrl from PUT /v1/integrations/supabase_auth/connection>'
  const plannedRequests = (webhookUrl: string): ProviderRequest[] => [
    {
      vendor: 'Brew',
      method: 'PUT',
      url: '/v1/integrations/supabase_auth/connection',
      body: { signingSecret: REDACTED_SECRET, settings: { projectUrl } },
    },
    {
      vendor: 'Supabase',
      method: 'PATCH',
      url: supabaseAuthConfigUrl(ref),
      body: {
        hook_send_email_enabled: true,
        hook_send_email_uri: webhookUrl,
        hook_send_email_secrets: REDACTED_SECRET,
      } satisfies SendEmailHookBody,
    },
  ]
  if (input.dryRun) {
    return {
      step: {
        id: 'provider',
        status: 'planned',
        detail: `connect Brew, then point project ${ref}'s Send Email hook at it (old settings saved for --rollback-provider)`,
      },
      nextSteps,
      providers: [
        {
          provider: 'supabase_auth',
          action: 'planned',
          connection,
          projectRef: ref,
          previous: hook.config,
          requests: plannedRequests(webhookPlaceholder),
          rollbackCommand: rollbackCommandFor(input),
          detail: 'dry run',
        },
      ],
      providerConfig: input.providerConfig,
    }
  }
  const client = input.client as BrewClient

  // Save the settings being replaced BEFORE replacing them. The first save
  // wins: a re-run never overwrites the pre-Brew settings with Brew's own.
  let providerConfig = input.providerConfig
  const saved = providerConfig.supabase_auth
  if (saved === undefined || saved.projectRef !== ref) {
    let previousSecretsVariable: string | undefined
    // The backup an earlier save left, which goes back if this save fails.
    const secretBefore = savedHookSecret(input.writer)
    if (hook.config.hook_send_email_enabled && hook.secrets !== null) {
      // A rollback puts the old hook back whole, secret included.
      if (!backupHookSecret(input.writer, hook.secrets)) {
        return failed(
          input,
          'supabase_auth',
          `hook left as it is: its secret could not be saved to .env.local (${SUPABASE_PREVIOUS_SECRETS_VARIABLE}) for --rollback-provider`,
          ref,
          connection
        )
      }
      previousSecretsVariable = SUPABASE_PREVIOUS_SECRETS_VARIABLE
    }
    providerConfig = {
      ...providerConfig,
      supabase_auth: {
        projectRef: ref,
        savedAt: new Date(input.now()).toISOString(),
        previous: hook.config,
        ...(previousSecretsVariable === undefined
          ? {}
          : { previousSecretsVariable }),
      },
    }
    if (!input.persist(providerConfig)) {
      // brew.json keeps the earlier settings: they keep their secret too.
      if (previousSecretsVariable !== undefined) {
        backupHookSecret(input.writer, secretBefore)
      }
      return failed(input, 'supabase_auth', NOT_SAVED, ref, connection)
    }
  }
  // From here every result keeps the saved settings with their secret.
  const withSaved = { ...input, providerConfig }

  const signingSecret = generateHookSecret()
  let connected: Awaited<ReturnType<BrewClient['integrations']['connect']>>
  try {
    progress(ctx, 'Connecting Brew as the Supabase Send Email hook…')
    connected = await client.integrations.connect({
      provider: 'supabase_auth',
      signingSecret,
      settings: { projectUrl },
    })
  } catch (error) {
    rethrowIfFatal(ctx, error)
    return failed(
      input,
      'supabase_auth',
      describe(error),
      ref,
      connection,
      providerConfig
    )
  }
  // The hook hands Brew every auth email: each must be set up and reach
  // every user (not the team-only sandbox) before Supabase stops sending.
  let reachable: Set<string>
  try {
    reachable = await publicKeys(
      client,
      connected.authEmails.map((email) => email.triggerKey)
    )
  } catch (error) {
    rethrowIfFatal(ctx, error)
    return failed(withSaved, 'supabase_auth', describe(error), ref, connection)
  }
  const notReady = connected.authEmails
    .filter((email) => !email.ok || !reachable.has(email.triggerKey))
    .map((email) => email.triggerKey)
  if (notReady.length > 0) {
    nextSteps.push({
      id: 'rerun-supabase-connect',
      actor: 'agent',
      kind: 'run-command',
      command: `${input.init} --configure-supabase${picked} --yes`,
      title: `Run again once these auth emails reach every user (set up, and a verified transactional domain, not the sandbox): ${notReady.join(', ')}. Supabase keeps sending its own until then`,
      blocking: true,
    })
    return refused(
      withSaved,
      'supabase_auth',
      connectionOf(connected),
      ref,
      `hook left as it is: ${notReady.join(', ')} cannot reach every user yet`,
      nextSteps
    )
  }
  const requests = plannedRequests(connected.webhookUrl)
  try {
    progress(ctx, `Pointing Supabase project ${ref}'s Send Email hook at Brew…`)
    await patchSendEmailHook(ctx, {
      ref,
      token,
      body: {
        hook_send_email_enabled: true,
        hook_send_email_uri: connected.webhookUrl,
        hook_send_email_secrets: signingSecret,
      },
    })
  } catch (error) {
    ctx.signal.throwIfAborted()
    return failed(
      input,
      'supabase_auth',
      `Brew is connected, but Supabase refused the hook: ${describe(error)}`,
      ref,
      connectionOf(connected),
      providerConfig
    )
  }
  nextSteps.push(
    {
      id: 'verify-supabase-hook',
      actor: 'human',
      kind: 'review',
      title: `Sign up (or request a magic link) with a test address: Supabase now hands the email to Brew, and \`${prefix} integrations connection supabase_auth${input.scope}\` turns active`,
      blocking: false,
    },
    {
      id: 'rollback-supabase-hook',
      actor: 'agent',
      kind: 'run-command',
      command: rollbackCommandFor(input),
      title:
        "To undo: put Supabase's previous Send Email hook settings back (with SUPABASE_ACCESS_TOKEN set)",
      blocking: false,
    }
  )
  return {
    step: {
      id: 'provider',
      status: 'done',
      detail: `Supabase Send Email hook → Brew (${connected.status}); old settings saved for --rollback-provider`,
    },
    nextSteps,
    providers: [
      {
        provider: 'supabase_auth',
        action: 'configured',
        connection: connectionOf(connected),
        projectRef: ref,
        previous: providerConfig.supabase_auth?.previous ?? hook.config,
        requests,
        rollbackCommand: rollbackCommandFor(input),
        detail: 'connected and pointed at Brew',
      },
    ],
    providerConfig,
  }
}

// ------------------------------------------------------------------- Clerk

async function clerkStep(
  input: ProviderStepInput
): Promise<ProviderStepResult> {
  const { ctx, prefix } = input
  const nextSteps: NextStep[] = []
  const read = await readConnection(input, 'clerk')
  if (!read.ok) {
    return failed(input, 'clerk', read.error)
  }
  const connection = read.connection
  const status = connection?.status ?? 'not connected'
  const connectSteps = (): void => {
    if (connection === null) {
      nextSteps.push({
        id: 'connect-clerk',
        actor: 'human',
        kind: 'open-url',
        url: 'https://dashboard.clerk.com/last-active?path=webhooks',
        title: `Hand Clerk's auth emails to Brew (Clerk keeps sending them until then): in the Clerk Dashboard, add a webhook endpoint subscribed to email.created (any https URL for now) and copy its signing secret into CLERK_WEBHOOK_SIGNING_SECRET; run \`${prefix} integrations connect clerk${input.scope} --signing-secret-env CLERK_WEBHOOK_SIGNING_SECRET --yes\`, then change the endpoint URL to the webhook URL it prints`,
        blocking: false,
      })
    } else if (connection.status !== 'active') {
      nextSteps.push({
        id: 'verify-clerk-webhook',
        actor: 'human',
        kind: 'open-url',
        url: 'https://dashboard.clerk.com/last-active?path=webhooks',
        title: `Make sure the Clerk endpoint URL is ${connection.webhookUrl}, then send it a test email.created (endpoint > Testing) or sign up a test user: \`${prefix} integrations connection clerk${input.scope}\` turns active`,
        blocking: false,
      })
    }
  }
  if (!input.configureClerk) {
    connectSteps()
    if (connection?.status === 'active') {
      nextSteps.push({
        id: 'configure-clerk-delivery',
        actor: 'agent',
        kind: 'run-command',
        command: `${input.init} --configure-clerk --yes`,
        title: `Brew receives Clerk's emails now. To have Brew send them, turn off "Delivered by Clerk" for the templates Brew sends: run this with ${CLERK_SECRET_VARIABLE} available (saved for --rollback-provider), or switch them off in the Clerk Dashboard`,
        blocking: false,
      })
    }
    return {
      step: {
        id: 'provider',
        status: 'skipped',
        detail: `Clerk keeps delivering its auth emails (connection: ${status}; opt in with --configure-clerk)`,
      },
      nextSteps,
      providers: [
        {
          provider: 'clerk',
          action: 'manual',
          connection,
          requests: [],
          rollbackCommand: null,
          detail: 'manual steps printed',
        },
      ],
      providerConfig: input.providerConfig,
    }
  }

  // --configure-clerk: only once Brew has verified Clerk's deliveries.
  if (input.client === undefined) {
    return {
      step: {
        id: 'provider',
        status: 'planned',
        detail:
          "after sign-in, and only once Brew's Clerk connection is active",
      },
      nextSteps,
      providers: [
        {
          provider: 'clerk',
          action: 'planned',
          connection: null,
          requests: [],
          rollbackCommand: rollbackCommandFor(input),
          detail: 'needs a Brew credential',
        },
      ],
      providerConfig: input.providerConfig,
    }
  }
  if (connection?.status !== 'active') {
    connectSteps()
    return refused(
      input,
      'clerk',
      connection,
      undefined,
      `Clerk delivery left on: Brew's Clerk connection is ${status}, not active, so Brew could not send these emails yet`,
      nextSteps
    )
  }
  const secretKey = readClerkSecret({ root: input.root, env: ctx.io.env })
  if (secretKey === undefined) {
    nextSteps.push({
      id: 'clerk-secret-key',
      actor: 'human',
      kind: 'set-secret',
      title: `Make ${CLERK_SECRET_VARIABLE} (Clerk Dashboard > API keys) available in this shell or .env.local, then run init --configure-clerk again; it stays on this machine`,
      blocking: true,
    })
    return refused(
      input,
      'clerk',
      connection,
      undefined,
      `${CLERK_SECRET_VARIABLE} not found`,
      nextSteps
    )
  }
  // A later run adds templates to the saved list: only from the same key.
  const keyId = clerkKeyId(secretKey)
  if ((input.providerConfig.clerk?.keyId ?? keyId) !== keyId) {
    return refused(
      input,
      'clerk',
      connection,
      undefined,
      `${CLERK_SECRET_VARIABLE} is not the key of the Clerk instance brew.json saved; roll that instance back first`,
      nextSteps
    )
  }
  // Exactly the templates Brew sends to every user: a slug whose key's app
  // email is published and not in the team-only sandbox.
  let reachable: Set<string>
  try {
    reachable = await publicKeys(
      input.client,
      Object.values(CLERK_EMAIL_SLUG_KEYS)
    )
  } catch (error) {
    rethrowIfFatal(ctx, error)
    return failed(input, 'clerk', describe(error), undefined, connection)
  }
  const slugs = Object.entries(CLERK_EMAIL_SLUG_KEYS)
    .filter(([, key]) => reachable.has(key))
    .map(([slug]) => slug)
  const toTurnOff: string[] = []
  try {
    for (const slug of slugs) {
      const delivered = await readClerkDelivery(ctx, { secretKey, slug })
      if (delivered === true) {
        toTurnOff.push(slug)
      }
    }
  } catch (error) {
    ctx.signal.throwIfAborted()
    return failed(input, 'clerk', describe(error), undefined, connection)
  }
  const requests: ProviderRequest[] = toTurnOff.map((slug) => ({
    vendor: 'Clerk',
    method: 'POST',
    url: clerkToggleUrl(slug),
    body: { delivered_by_clerk: false },
  }))
  if (toTurnOff.length === 0) {
    return {
      step: {
        id: 'provider',
        status: 'done',
        detail:
          slugs.length === 0
            ? 'no Brew app email for a Clerk template reaches every user yet (published, with a verified domain); Clerk delivery left on'
            : 'Clerk delivery is already off for the templates Brew sends',
      },
      nextSteps,
      providers: [
        {
          provider: 'clerk',
          action: 'unchanged',
          connection,
          templates: [],
          requests: [],
          rollbackCommand:
            input.providerConfig.clerk === undefined
              ? null
              : rollbackCommandFor(input),
          detail: 'nothing to turn off',
        },
      ],
      providerConfig: input.providerConfig,
    }
  }
  if (input.dryRun) {
    return {
      step: {
        id: 'provider',
        status: 'planned',
        detail: `turn off Clerk delivery for ${toTurnOff.length} templates Brew sends (saved for --rollback-provider)`,
      },
      nextSteps,
      providers: [
        {
          provider: 'clerk',
          action: 'planned',
          connection,
          templates: toTurnOff,
          previous: Object.fromEntries(toTurnOff.map((slug) => [slug, true])),
          requests,
          rollbackCommand: rollbackCommandFor(input),
          detail: 'dry run',
        },
      ],
      providerConfig: input.providerConfig,
    }
  }
  const providerConfig: ProviderConfig = {
    ...input.providerConfig,
    clerk: {
      savedAt:
        input.providerConfig.clerk?.savedAt ??
        new Date(input.now()).toISOString(),
      keyId,
      templates: [
        ...new Set([
          ...(input.providerConfig.clerk?.templates ?? []),
          ...toTurnOff,
        ]),
      ].sort(),
    },
  }
  if (!input.persist(providerConfig)) {
    return failed(input, 'clerk', NOT_SAVED, undefined, connection)
  }
  const done: string[] = []
  try {
    for (const slug of toTurnOff) {
      progress(ctx, `Turning off Clerk delivery for ${slug}…`)
      await setClerkDelivery(ctx, {
        secretKey,
        slug,
        deliveredByClerk: false,
      })
      done.push(slug)
    }
  } catch (error) {
    ctx.signal.throwIfAborted()
    nextSteps.push({
      id: 'clerk-delivery-dashboard',
      actor: 'human',
      kind: 'open-url',
      url: CLERK_EMAILS_DASHBOARD_URL,
      title: `Turn off "Delivered by Clerk" by hand for: ${toTurnOff.filter((slug) => !done.includes(slug)).join(', ')}`,
      blocking: false,
    })
    return {
      step: {
        id: 'provider',
        status: 'failed',
        detail: `turned off ${done.length} of ${toTurnOff.length} Clerk templates: ${describe(error)}`,
      },
      nextSteps,
      providers: [
        {
          provider: 'clerk',
          action: 'failed',
          connection,
          templates: done,
          requests: requests.filter((request) =>
            done.some((slug) => request.url === clerkToggleUrl(slug))
          ),
          rollbackCommand: rollbackCommandFor(input),
          detail: describe(error),
        },
      ],
      providerConfig,
    }
  }
  nextSteps.push({
    id: 'rollback-clerk-delivery',
    actor: 'agent',
    kind: 'run-command',
    command: rollbackCommandFor(input),
    title: `To undo: turn Clerk's delivery back on for these templates (with ${CLERK_SECRET_VARIABLE} available)`,
    blocking: false,
  })
  return {
    step: {
      id: 'provider',
      status: 'done',
      detail: `Clerk delivery off for ${done.length} templates Brew sends (${done.join(', ')}); saved for --rollback-provider`,
    },
    nextSteps,
    providers: [
      {
        provider: 'clerk',
        action: 'configured',
        connection,
        templates: done,
        previous: Object.fromEntries(done.map((slug) => [slug, true])),
        requests,
        rollbackCommand: rollbackCommandFor(input),
        detail: 'delivery handed to Brew',
      },
    ],
    providerConfig,
  }
}

/**
 * Which of `wanted` have an app email a fire sends now to anyone, not the
 * sandbox only. Reads pages until every wanted key has its row or the list
 * ends (a cursor seen before ends it too).
 */
async function publicKeys(
  client: BrewClient,
  wanted: readonly string[]
): Promise<Set<string>> {
  const pending = new Set(wanted)
  const keys = new Set<string>()
  const seen = new Set<string>()
  let cursor: string | undefined
  while (pending.size > 0) {
    const result = await client.appEmails.list({
      limit: 100,
      ...(cursor === undefined ? {} : { cursor }),
    })
    for (const row of result.data) {
      if (!pending.delete(row.triggerKey)) {
        continue
      }
      if (row.readiness.ready && !row.readiness.teamOnly) {
        keys.add(row.triggerKey)
      }
    }
    const next = result.pagination.cursor
    if (!result.pagination.hasMore || next === null || seen.has(next)) {
      break
    }
    seen.add(next)
    cursor = next
  }
  return keys
}

// ---------------------------------------------------------------- shared

export function rollbackCommandFor(
  input: Pick<ProviderStepInput, 'init'>
): string {
  return `${input.init} --rollback-provider --yes`
}

function refused(
  input: ProviderStepInput,
  provider: HostedAuthProvider,
  connection: InitProvider['connection'],
  ref: string | null | undefined,
  detail: string,
  nextSteps: readonly NextStep[]
): ProviderStepResult {
  return {
    step: { id: 'provider', status: 'skipped', detail },
    nextSteps,
    providers: [
      {
        provider,
        action: 'refused',
        connection,
        ...(ref === undefined ? {} : { projectRef: ref }),
        requests: [],
        rollbackCommand: null,
        detail,
      },
    ],
    providerConfig: input.providerConfig,
  }
}

function failed(
  input: ProviderStepInput,
  provider: HostedAuthProvider,
  detail: string,
  ref?: string | null,
  connection: InitProvider['connection'] = null,
  providerConfig: ProviderConfig = input.providerConfig
): ProviderStepResult {
  return {
    step: { id: 'provider', status: 'failed', detail },
    nextSteps: [],
    providers: [
      {
        provider,
        action: 'failed',
        connection,
        ...(ref === undefined ? {} : { projectRef: ref }),
        requests: [],
        rollbackCommand:
          providerConfig[provider] === undefined
            ? null
            : rollbackCommandFor(input),
        detail,
      },
    ],
    providerConfig,
  }
}
