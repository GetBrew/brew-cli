import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { HttpResponse, http } from 'msw'
import { expect } from 'vitest'
import { copyFixture } from './fixtures'
import { type Recorded, read, webhookUrlFor } from './init-api'
import { APP_KEY } from './login-server'
import { server } from './msw-server'

/** Supabase's Management API and Clerk's Backend API for init's provider step. */

export const SUPABASE = 'https://api.supabase.com'
export const CLERK = 'https://api.clerk.com/v1'
export const REF = 'abcdefghijklmnopqrst'
export const SB_TOKEN = 'sbp_0123456789abcdefghijklmnopqrstuvwxyz0123'
export const CLERK_SECRET_KEY = 'sk_test_clerkSecret0123456789abcdefghijkl'
export const OLD_HOOK_SECRET =
  'v1,whsec_b2xkaG9va3NlY3JldGZvcmFub3RoZXJmdW5jdGlvbg=='
export const OLD_HOOK_URI =
  'https://abcdefghijklmnopqrst.supabase.co/functions/v1/send-email'

export type VendorCall = {
  readonly method: string
  readonly path: string
  readonly body: unknown
  readonly authorization: string | null
}

export type HookState = {
  enabled: boolean
  uri: string | null
  secrets: string | null
}

/** The Management API's auth config, holding the Send Email hook. */
export function useSupabaseApi(
  initial: HookState,
  options: {
    readonly patchStatus?: number
    readonly beforePatch?: () => void
  } = {}
): { readonly calls: VendorCall[]; readonly hook: HookState } {
  const hook = { ...initial }
  const calls: VendorCall[] = []
  server.use(
    http.get(`${SUPABASE}/v1/projects/:ref/config/auth`, ({ request }) => {
      calls.push({
        method: 'GET',
        path: new URL(request.url).pathname,
        body: undefined,
        authorization: request.headers.get('authorization'),
      })
      return HttpResponse.json({
        site_url: 'http://localhost:3000',
        hook_send_email_enabled: hook.enabled,
        hook_send_email_uri: hook.uri,
        hook_send_email_secrets: hook.secrets,
      })
    }),
    http.patch(
      `${SUPABASE}/v1/projects/:ref/config/auth`,
      async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        calls.push({
          method: 'PATCH',
          path: new URL(request.url).pathname,
          body,
          authorization: request.headers.get('authorization'),
        })
        options.beforePatch?.()
        if (options.patchStatus !== undefined) {
          // A vendor that echoes the secret back must not leak it.
          return HttpResponse.json(
            {
              message: `Invalid hook secret ${String(body.hook_send_email_secrets)} for token ${SB_TOKEN}`,
            },
            { status: options.patchStatus }
          )
        }
        if (typeof body.hook_send_email_enabled === 'boolean') {
          hook.enabled = body.hook_send_email_enabled
        }
        if ('hook_send_email_uri' in body) {
          hook.uri = body.hook_send_email_uri as string | null
        }
        if (typeof body.hook_send_email_secrets === 'string') {
          hook.secrets = body.hook_send_email_secrets
        }
        return HttpResponse.json({})
      }
    )
  )
  return { calls, hook }
}

/** Clerk's email templates and their "Delivered by Clerk" switch. */
export function useClerkApi(delivered: Record<string, boolean>): {
  readonly calls: VendorCall[]
  readonly delivered: Record<string, boolean>
} {
  const calls: VendorCall[] = []
  const state = { ...delivered }
  server.use(
    http.get(`${CLERK}/templates/email/:slug`, ({ request, params }) => {
      const slug = String(params.slug)
      calls.push({
        method: 'GET',
        path: new URL(request.url).pathname,
        body: undefined,
        authorization: request.headers.get('authorization'),
      })
      if (!(slug in state)) {
        return HttpResponse.json(
          { errors: [{ message: 'not found', code: 'resource_not_found' }] },
          { status: 404 }
        )
      }
      return HttpResponse.json({
        object: 'template',
        slug,
        delivered_by_clerk: state[slug],
      })
    }),
    http.post(
      `${CLERK}/templates/email/:slug/toggle_delivery`,
      async ({ request, params }) => {
        const body = (await request.json()) as { delivered_by_clerk: boolean }
        calls.push({
          method: 'POST',
          path: new URL(request.url).pathname,
          body,
          authorization: request.headers.get('authorization'),
        })
        state[String(params.slug)] = body.delivered_by_clerk
        return HttpResponse.json({
          object: 'template',
          slug: String(params.slug),
          delivered_by_clerk: body.delivered_by_clerk,
        })
      }
    )
  )
  return { calls, delivered: state }
}

/** Every secret stays out of stdout, stderr and brew.json. */
export function expectNoSecrets(
  root: string,
  result: { readonly stdout: string; readonly stderr: string },
  secrets: readonly string[]
): void {
  const state = existsSync(join(root, 'brew.json'))
    ? read(root, 'brew.json')
    : ''
  for (const secret of secrets) {
    expect(result.stdout).not.toContain(secret)
    expect(result.stderr).not.toContain(secret)
    expect(state).not.toContain(secret)
  }
}

/** No Brew request ever carries a provider token. */
export function expectBrewNeverSaw(
  requests: readonly Recorded[],
  secrets: readonly string[]
): void {
  const text = JSON.stringify(requests)
  for (const secret of secrets) {
    expect(text).not.toContain(secret)
  }
}

export function supabaseProject(): string {
  const root = copyFixture('vite-supabase-lovable')
  writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
  return root
}

export function clerkProject(): string {
  const root = copyFixture('react-router-clerk')
  writeFileSync(join(root, '.env.local'), `BREW_API_KEY=${APP_KEY}\n`)
  return root
}

export const ACTIVE_CLERK = {
  provider: 'clerk',
  connectionId: 'conn_clerk',
  webhookUrl: webhookUrlFor('clerk'),
  status: 'active',
}
