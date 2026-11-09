import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { CliVendorError } from '../../errors'
import { getEnvValue, parseEnv } from '../../project/env-file'
import { readTextFile } from '../../project/fs-writer'
import { vendorFetch } from '../../project/vendor-http'
import type { CliContext } from '../../types'

/**
 * Clerk's per-template "Delivered by Clerk" switch, through the Clerk
 * Backend API with the app's own `CLERK_SECRET_KEY` (read locally, sent to
 * api.clerk.com only, never to Brew). Base URL `https://api.clerk.com/v1`,
 * `Authorization: Bearer sk_…`.
 *
 * - `GET /templates/{template_type}/{slug}` ("Retrieve a template"): the
 *   template, with `delivered_by_clerk`.
 * - `POST /templates/{template_type}/{slug}/toggle_delivery` ("Toggle the
 *   delivery by Clerk for a template of a given type and slug"), body
 *   `{ "delivered_by_clerk": boolean }`; with it off, Clerk does not send
 *   the email and the app handles `email.created` itself.
 *
 * Both are in Clerk's Backend API reference
 * (https://clerk.com/docs/reference/backend-api, tag "Email & SMS
 * Templates"; spec https://github.com/clerk/openapi-specs/blob/main/bapi/2026-08-20.yml),
 * where they are marked deprecated in favour of the dashboard but still
 * served. A 404 is a template this instance does not have; 402/423 mean the
 * instance's plan does not allow the change (do it in the dashboard).
 */

export const CLERK_API_URL = 'https://api.clerk.com/v1'

export const CLERK_SECRET_VARIABLE = 'CLERK_SECRET_KEY'

/**
 * Clerk email template slug → the kit key Brew sends for it: brew-v2
 * `lib/app-emails/auth-routing.ts` `CLERK_EMAIL_SLUG_ROUTES`
 * (GetBrew/brew-v2#2169). Delivery is turned off only for a slug whose key's
 * app email reaches every user (published, not the team-only sandbox).
 */
export const CLERK_EMAIL_SLUG_KEYS: Readonly<Record<string, string>> = {
  verification_code: 'auth.otp',
  reset_password_code: 'auth.password-reset',
  magic_link_sign_in: 'auth.magic-link',
  magic_link_sign_up: 'auth.verify-email',
  magic_link_user_profile: 'auth.verify-email',
  invitation: 'auth.invite',
  organization_invitation: 'auth.invite',
  password_changed: 'auth.security-notice',
  password_removed: 'auth.security-notice',
  primary_email_address_changed: 'auth.security-notice',
  passkey_added: 'auth.security-notice',
  passkey_removed: 'auth.security-notice',
}

export function clerkTemplateUrl(slug: string): string {
  return `${CLERK_API_URL}/templates/email/${encodeURIComponent(slug)}`
}

export function clerkToggleUrl(slug: string): string {
  return `${clerkTemplateUrl(slug)}/toggle_delivery`
}

/** The Clerk Dashboard page with the per-template switch. */
export const CLERK_EMAILS_DASHBOARD_URL =
  'https://dashboard.clerk.com/last-active?path=customization/email'

/**
 * `CLERK_SECRET_KEY` from the environment, else the app's `.env.local` or
 * `.env` (where Clerk's quickstarts put it). Never sent to Brew.
 */
export function readClerkSecret(input: {
  readonly root: string
  readonly env: Readonly<Record<string, string | undefined>>
}): string | undefined {
  const fromEnv = input.env[CLERK_SECRET_VARIABLE]?.trim()
  if (fromEnv !== undefined && fromEnv !== '') {
    return fromEnv
  }
  for (const file of ['.env.local', '.env']) {
    const text = readTextFile(join(input.root, file))
    const value =
      text === null
        ? undefined
        : getEnvValue(parseEnv(text), CLERK_SECRET_VARIABLE)?.trim()
    if (value !== undefined && value !== '') {
      return value
    }
  }
  return undefined
}

/**
 * Which key, so which Clerk instance, changed delivery: a SHA-256 prefix
 * brew.json keeps (the key cannot be recovered from it), so a rollback
 * never turns delivery on in another instance.
 */
export function clerkKeyId(secretKey: string): string {
  return createHash('sha256').update(secretKey).digest('hex').slice(0, 16)
}

/** `delivered_by_clerk` for one email template; `null` when it does not exist. */
export async function readClerkDelivery(
  ctx: Pick<CliContext, 'signal' | 'budget'>,
  input: { readonly secretKey: string; readonly slug: string }
): Promise<boolean | null> {
  try {
    const response = await vendorFetch(ctx, {
      vendor: 'Clerk',
      method: 'GET',
      url: clerkTemplateUrl(input.slug),
      headers: { authorization: `Bearer ${input.secretKey}` },
    })
    const record =
      typeof response.json === 'object' && response.json !== null
        ? (response.json as Record<string, unknown>)
        : {}
    return record.delivered_by_clerk !== false
  } catch (error) {
    if (error instanceof CliVendorError && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function setClerkDelivery(
  ctx: Pick<CliContext, 'signal' | 'budget'>,
  input: {
    readonly secretKey: string
    readonly slug: string
    readonly deliveredByClerk: boolean
  }
): Promise<void> {
  await vendorFetch(ctx, {
    vendor: 'Clerk',
    method: 'POST',
    url: clerkToggleUrl(input.slug),
    headers: { authorization: `Bearer ${input.secretKey}` },
    json: { delivered_by_clerk: input.deliveredByClerk },
    maxAttempts: 2,
  })
}
