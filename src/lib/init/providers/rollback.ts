import { CliUsageError } from '../../errors'
import { progress } from '../../output'
import { getEnvValue, parseEnv } from '../../project/env-file'
import type { ProjectWriter } from '../../project/fs-writer'
import type { CliContext } from '../../types'
import type { InitStep, NextStep } from '../report'
import {
  CLERK_EMAILS_DASHBOARD_URL,
  CLERK_SECRET_VARIABLE,
  clerkToggleUrl,
  readClerkSecret,
  setClerkDelivery,
} from './clerk'
import type { InitProvider, ProviderConfig, ProviderRequest } from './step'
import {
  patchSendEmailHook,
  REDACTED_SECRET,
  type SendEmailHookBody,
  SUPABASE_TOKEN_VARIABLE,
  supabaseAuthConfigUrl,
  supabaseHooksUrl,
} from './supabase'

/**
 * `init --rollback-provider`: put back what `--configure-supabase` and
 * `--configure-clerk` changed, from `brew.json#providerConfig`. Supabase's
 * Send Email hook gets its previous `enabled` and `uri` (and its previous
 * secret, from `.env.local`, when one was saved); Clerk's delivery goes back
 * on for exactly the templates init turned off. A restored provider leaves
 * `providerConfig`. Brew's connection stays as it is (harmless once the
 * provider no longer delivers to it).
 */

export type RollbackResult = {
  readonly step: InitStep
  readonly nextSteps: readonly NextStep[]
  readonly providers: readonly InitProvider[]
  readonly providerConfig: ProviderConfig
}

function localValue(
  ctx: CliContext,
  writer: ProjectWriter,
  name: string
): string | undefined {
  const fromEnv = ctx.io.env[name]?.trim()
  if (fromEnv !== undefined && fromEnv !== '') {
    return fromEnv
  }
  const text = writer.read('.env.local')
  const value =
    text === null ? undefined : getEnvValue(parseEnv(text), name)?.trim()
  return value === undefined || value === '' ? undefined : value
}

export async function runProviderRollback(input: {
  readonly ctx: CliContext
  readonly root: string
  readonly writer: ProjectWriter
  readonly dryRun: boolean
  readonly providerConfig: ProviderConfig
}): Promise<RollbackResult> {
  const { ctx, writer, dryRun } = input
  const saved = input.providerConfig
  if (saved.supabase_auth === undefined && saved.clerk === undefined) {
    throw new CliUsageError(
      'brew.json has no provider settings to roll back (init saves them only when --configure-supabase or --configure-clerk changes a provider).'
    )
  }
  let remaining: ProviderConfig = { ...saved }
  const providers: InitProvider[] = []
  const nextSteps: NextStep[] = []
  const problems: string[] = []

  const supabase = saved.supabase_auth
  if (supabase !== undefined) {
    const token = localValue(ctx, writer, SUPABASE_TOKEN_VARIABLE)
    const previousSecrets =
      supabase.previousSecretsVariable === undefined
        ? undefined
        : localValue(ctx, writer, supabase.previousSecretsVariable)
    const previous = supabase.previous
    // The hook's previous `enabled` and URL; a hook that was on also gets
    // its secret back when this machine kept it.
    const body: SendEmailHookBody = {
      hook_send_email_enabled: previous.hook_send_email_enabled,
      hook_send_email_uri: previous.hook_send_email_uri,
      ...(previous.hook_send_email_enabled && previousSecrets !== undefined
        ? { hook_send_email_secrets: previousSecrets }
        : {}),
    }
    const shown: ProviderRequest = {
      vendor: 'Supabase',
      method: 'PATCH',
      url: supabaseAuthConfigUrl(supabase.projectRef),
      body:
        body.hook_send_email_secrets === undefined
          ? sendable(body)
          : { ...sendable(body), hook_send_email_secrets: REDACTED_SECRET },
    }
    const secretMissing =
      previous.hook_send_email_enabled && previousSecrets === undefined
    if (secretMissing) {
      nextSteps.push({
        id: 'restore-supabase-hook-secret',
        actor: 'human',
        kind: 'open-url',
        url: supabaseHooksUrl(supabase.projectRef),
        title:
          "Re-enter the previous Send Email hook's secret in Supabase (Authentication > Hooks): this machine did not keep it",
        blocking: true,
      })
    }
    if (token === undefined) {
      problems.push(`${SUPABASE_TOKEN_VARIABLE} is not set`)
      nextSteps.push({
        id: 'supabase-access-token',
        actor: 'human',
        kind: 'set-secret',
        url: 'https://supabase.com/dashboard/account/tokens',
        title: `Export a Supabase personal access token as ${SUPABASE_TOKEN_VARIABLE}, then run the rollback again`,
        blocking: true,
      })
      providers.push({
        provider: 'supabase_auth',
        action: 'refused',
        connection: null,
        projectRef: supabase.projectRef,
        previous,
        requests: [],
        rollbackCommand: null,
        detail: `${SUPABASE_TOKEN_VARIABLE} is not set`,
      })
    } else if (dryRun) {
      providers.push({
        provider: 'supabase_auth',
        action: 'planned',
        connection: null,
        projectRef: supabase.projectRef,
        previous,
        requests: [shown],
        rollbackCommand: null,
        detail: 'dry run',
      })
    } else {
      try {
        progress(
          ctx,
          `Restoring Supabase project ${supabase.projectRef}'s Send Email hook…`
        )
        await patchSendEmailHook(ctx, {
          ref: supabase.projectRef,
          token,
          body: sendable(body),
        })
        const { supabase_auth: _restored, ...rest } = remaining
        remaining = rest
        providers.push({
          provider: 'supabase_auth',
          action: 'restored',
          connection: null,
          projectRef: supabase.projectRef,
          previous,
          requests: [shown],
          rollbackCommand: null,
          detail: previous.hook_send_email_enabled
            ? 'previous Send Email hook restored'
            : 'Send Email hook off again: Supabase sends its own auth emails',
        })
      } catch (error) {
        ctx.signal.throwIfAborted()
        const detail = error instanceof Error ? error.message : String(error)
        problems.push(detail)
        providers.push({
          provider: 'supabase_auth',
          action: 'failed',
          connection: null,
          projectRef: supabase.projectRef,
          previous,
          requests: [],
          rollbackCommand: null,
          detail,
        })
      }
    }
  }

  const clerk = saved.clerk
  if (clerk !== undefined) {
    const secretKey = readClerkSecret({ root: input.root, env: ctx.io.env })
    const requests: ProviderRequest[] = clerk.templates.map((slug) => ({
      vendor: 'Clerk',
      method: 'POST',
      url: clerkToggleUrl(slug),
      body: { delivered_by_clerk: true },
    }))
    if (secretKey === undefined) {
      problems.push(`${CLERK_SECRET_VARIABLE} not found`)
      nextSteps.push({
        id: 'clerk-secret-key',
        actor: 'human',
        kind: 'set-secret',
        title: `Make ${CLERK_SECRET_VARIABLE} available in this shell or .env.local, then run the rollback again (or turn "Delivered by Clerk" back on in the dashboard for: ${clerk.templates.join(', ')})`,
        url: CLERK_EMAILS_DASHBOARD_URL,
        blocking: true,
      })
      providers.push({
        provider: 'clerk',
        action: 'refused',
        connection: null,
        templates: clerk.templates,
        requests: [],
        rollbackCommand: null,
        detail: `${CLERK_SECRET_VARIABLE} not found`,
      })
    } else if (dryRun) {
      providers.push({
        provider: 'clerk',
        action: 'planned',
        connection: null,
        templates: clerk.templates,
        requests,
        rollbackCommand: null,
        detail: 'dry run',
      })
    } else {
      const restored: string[] = []
      try {
        for (const slug of clerk.templates) {
          progress(ctx, `Turning Clerk delivery back on for ${slug}…`)
          await setClerkDelivery(ctx, {
            secretKey,
            slug,
            deliveredByClerk: true,
          })
          restored.push(slug)
        }
        const { clerk: _restored, ...rest } = remaining
        remaining = rest
        providers.push({
          provider: 'clerk',
          action: 'restored',
          connection: null,
          templates: restored,
          requests,
          rollbackCommand: null,
          detail: 'Clerk delivers these templates again',
        })
      } catch (error) {
        ctx.signal.throwIfAborted()
        const detail = error instanceof Error ? error.message : String(error)
        problems.push(detail)
        const left = clerk.templates.filter((slug) => !restored.includes(slug))
        remaining = {
          ...remaining,
          clerk: { savedAt: clerk.savedAt, templates: left },
        }
        providers.push({
          provider: 'clerk',
          action: 'failed',
          connection: null,
          templates: restored,
          requests: requests.filter((request) =>
            restored.some((slug) => request.url === clerkToggleUrl(slug))
          ),
          rollbackCommand: null,
          detail,
        })
      }
    }
  }

  const failedAny = providers.some((provider) => provider.action === 'failed')
  const refusedAny = providers.some((provider) => provider.action === 'refused')
  return {
    step: {
      id: 'provider',
      status: failedAny
        ? 'failed'
        : dryRun
          ? 'planned'
          : refusedAny
            ? 'skipped'
            : 'done',
      detail:
        problems.length > 0
          ? `not rolled back: ${problems.join('; ')}`
          : dryRun
            ? `restore ${providers.map((provider) => provider.provider).join(' and ')}`
            : `restored ${providers.map((provider) => provider.provider).join(' and ')}`,
    },
    nextSteps,
    providers,
    providerConfig: remaining,
  }
}

/** The PATCH body without `undefined` members. */
function sendable(body: SendEmailHookBody): SendEmailHookBody {
  return {
    hook_send_email_enabled: body.hook_send_email_enabled,
    hook_send_email_uri: body.hook_send_email_uri,
    ...(body.hook_send_email_secrets === undefined
      ? {}
      : { hook_send_email_secrets: body.hook_send_email_secrets }),
  }
}
