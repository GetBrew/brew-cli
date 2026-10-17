import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { getEnvValue, parseEnv } from '../../project/env-file'
import { readTextFile } from '../../project/fs-writer'
import { vendorFetch } from '../../project/vendor-http'
import type { CliContext } from '../../types'

/**
 * Supabase Auth's Send Email hook, through the Supabase Management API with
 * the person's own access token (`SUPABASE_ACCESS_TOKEN`, read locally and
 * sent to api.supabase.com only, never to Brew):
 *
 * - `GET /v1/projects/{ref}/config/auth` ("Get a project's auth config",
 *   https://supabase.com/docs/reference/api/v1-get-auth-service-config)
 * - `PATCH /v1/projects/{ref}/config/auth` ("Update a project's auth
 *   config", https://supabase.com/docs/reference/api/v1-update-auth-service-config;
 *   scope `auth:write`, fine-grained permission `auth_config_write`)
 *
 * The hook is three fields of that config, in both the request and the
 * response (`UpdateAuthConfigBody` / `AuthConfigResponse` in the API spec,
 * https://api.supabase.com/api/v1-json): `hook_send_email_enabled`
 * (boolean), `hook_send_email_uri` (string) and `hook_send_email_secrets`
 * (string). The secret is a Standard Webhooks secret, `v1,whsec_<base64>`
 * (https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook).
 */

export const SUPABASE_API_URL = 'https://api.supabase.com'

export const SUPABASE_TOKEN_VARIABLE = 'SUPABASE_ACCESS_TOKEN'

/** A Supabase project ref: 20 lowercase letters (`<ref>.supabase.co`). */
export const SUPABASE_REF_PATTERN = /^[a-z]{20}$/

/** The `.env.local` line that keeps a replaced hook's secret for rollback. */
export const SUPABASE_PREVIOUS_SECRETS_VARIABLE =
  'BREW_SUPABASE_PREVIOUS_HOOK_SECRETS'

/** What a dry run shows where the generated secret goes. */
export const REDACTED_SECRET = '[generated v1,whsec_ secret, never shown]'

export type SendEmailHookConfig = {
  readonly hook_send_email_enabled: boolean
  readonly hook_send_email_uri: string | null
}

export type SendEmailHookBody = {
  readonly hook_send_email_enabled: boolean
  readonly hook_send_email_uri: string | null
  readonly hook_send_email_secrets?: string | null
}

export function supabaseAuthConfigUrl(ref: string): string {
  return `${SUPABASE_API_URL}/v1/projects/${ref}/config/auth`
}

export function supabaseProjectUrl(ref: string): string {
  return `https://${ref}.supabase.co`
}

/** The dashboard page where the hook lives, for manual steps. */
export function supabaseHooksUrl(ref: string | null): string {
  return `https://supabase.com/dashboard/project/${ref ?? '_'}/auth/hooks`
}

/** A fresh Standard Webhooks secret, generated here and never printed. */
export function generateHookSecret(): string {
  return `v1,whsec_${randomBytes(32).toString('base64')}`
}

/**
 * The project's current Send Email hook. `secrets` is the hook's current
 * secret, kept in memory only (a rollback puts it back from `.env.local`).
 */
export async function readSendEmailHook(
  ctx: Pick<CliContext, 'signal' | 'budget'>,
  input: { readonly ref: string; readonly token: string }
): Promise<{
  readonly config: SendEmailHookConfig
  readonly secrets: string | null
}> {
  const response = await vendorFetch(ctx, {
    vendor: 'Supabase',
    method: 'GET',
    url: supabaseAuthConfigUrl(input.ref),
    headers: { authorization: `Bearer ${input.token}` },
  })
  const record =
    typeof response.json === 'object' && response.json !== null
      ? (response.json as Record<string, unknown>)
      : {}
  const uri = record.hook_send_email_uri
  const secrets = record.hook_send_email_secrets
  return {
    config: {
      hook_send_email_enabled: record.hook_send_email_enabled === true,
      hook_send_email_uri: typeof uri === 'string' && uri !== '' ? uri : null,
    },
    secrets: typeof secrets === 'string' && secrets !== '' ? secrets : null,
  }
}

export async function patchSendEmailHook(
  ctx: Pick<CliContext, 'signal' | 'budget'>,
  input: {
    readonly ref: string
    readonly token: string
    readonly body: SendEmailHookBody
  }
): Promise<void> {
  await vendorFetch(ctx, {
    vendor: 'Supabase',
    method: 'PATCH',
    url: supabaseAuthConfigUrl(input.ref),
    headers: { authorization: `Bearer ${input.token}` },
    json: input.body,
    secrets:
      typeof input.body.hook_send_email_secrets === 'string'
        ? [
            input.body.hook_send_email_secrets,
            input.body.hook_send_email_secrets.replace(/^v1,whsec_/, ''),
          ]
        : [],
    // A PATCH is not retried on 429 past one short wait: it is idempotent,
    // but a person waiting on init should see the limit, not a stall.
    maxAttempts: 2,
  })
}

const URL_VARIABLES = [
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_URL',
] as const

const REF_IN_URL = /^https:\/\/([a-z]{20})\.supabase\.co(?:\/|$)/

/** The ref in a `https://<ref>.supabase.co` URL. */
function refFromUrl(value: string | undefined): string | undefined {
  return value === undefined ? undefined : REF_IN_URL.exec(value.trim())?.[1]
}

/**
 * Which Supabase project this app uses, from (in order) `--supabase-project`,
 * `supabase link`'s `supabase/.temp/project-ref`, a `*SUPABASE_URL` in the
 * environment or the project's env files, Lovable's generated client
 * (`src/integrations/supabase/client.ts`), or a `project_id` in
 * `supabase/config.toml` shaped like a real ref (Lovable writes the ref
 * there; a local-only project id is a free-form name).
 */
export function detectSupabaseRef(input: {
  readonly root: string
  readonly env: Readonly<Record<string, string | undefined>>
  readonly flag: string | undefined
}): { readonly ref: string; readonly source: string } | null {
  if (input.flag !== undefined) {
    return { ref: input.flag, source: '--supabase-project' }
  }
  const linked = readTextFile(
    join(input.root, 'supabase/.temp/project-ref')
  )?.trim()
  if (linked !== undefined && SUPABASE_REF_PATTERN.test(linked)) {
    return { ref: linked, source: 'supabase/.temp/project-ref' }
  }
  for (const name of URL_VARIABLES) {
    const ref = refFromUrl(input.env[name])
    if (ref !== undefined) {
      return { ref, source: name }
    }
  }
  for (const file of ['.env.local', '.env']) {
    const text = readTextFile(join(input.root, file))
    if (text === null) {
      continue
    }
    const parsed = parseEnv(text)
    for (const name of URL_VARIABLES) {
      const ref = refFromUrl(getEnvValue(parsed, name))
      if (ref !== undefined) {
        return { ref, source: `${file} ${name}` }
      }
    }
  }
  const lovable = readTextFile(
    join(input.root, 'src/integrations/supabase/client.ts')
  )
  const fromClient =
    lovable === null
      ? undefined
      : /https:\/\/([a-z]{20})\.supabase\.co/.exec(lovable)?.[1]
  if (fromClient !== undefined) {
    return { ref: fromClient, source: 'src/integrations/supabase/client.ts' }
  }
  const config = readTextFile(join(input.root, 'supabase/config.toml'))
  const projectId =
    config === null
      ? undefined
      : /^\s*project_id\s*=\s*"([^"]+)"/m.exec(config)?.[1]
  if (projectId !== undefined && SUPABASE_REF_PATTERN.test(projectId)) {
    return { ref: projectId, source: 'supabase/config.toml project_id' }
  }
  return null
}
