import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { BrewApiError } from '@brew.new/sdk'
import {
  type BrewClient,
  buildSdkClient,
  DEFAULT_API_URL,
  maskApiKey,
  type ResolvedAuth,
  resolveAuth,
} from '../client'
import { sdkTransportFor } from '../context'
import { CliApiError, CliUsageError } from '../errors'
import {
  API_URL_VARIABLE,
  reachesSdkRange,
  SDK_PACKAGE,
  SDK_RANGE,
} from '../init/templates'
import {
  findConnection,
  type HostedAuthProvider,
} from '../integrations/hosted-auth'
import { collectAll } from '../paginate'
import { getEnvValue, isClientExposedName, parseEnv } from '../project/env-file'
import { readTextFile, sha256Hex } from '../project/fs-writer'
import { isIgnored } from '../project/gitignore'
import { resolveCwd, resolveSpawn } from '../project/process'
import {
  BREW_STATE_FILE,
  type BrewProjectState,
  parseBrewState,
} from '../project/state'
import type { CliContext } from '../types'

/**
 * `doctor --project`: does this app still match its `brew.json`? Local
 * checks (managed files, the app key and where it lives, the SDK) and,
 * with a key, the brand's side (the keys exist and publish, the sending
 * domain, the hosted auth hook). Every check is `ok`, `warn` or `fail`
 * (`skipped` when it does not apply; a read that fails is `fail`); any
 * `fail` exits 1. Secrets never appear:
 * the key is masked, env values are never echoed.
 */

export type ProjectCheckStatus = 'ok' | 'warn' | 'fail' | 'skipped'

export type ProjectCheck = {
  readonly id:
    | 'state'
    | 'files'
    | 'env'
    | 'env-exposure'
    | 'gitignore'
    | 'sdk'
    | 'auth'
    | 'app-emails'
    | 'domain'
    | 'provider'
  readonly status: ProjectCheckStatus
  readonly detail: string
  /** Paths, keys or variable names behind a warn/fail. */
  readonly items?: readonly string[]
  readonly fix?: string
}

export type ProjectDoctorReport = {
  readonly ok: boolean
  readonly root: string
  readonly brandId: string | null
  readonly apiKey: string | null
  readonly checks: readonly ProjectCheck[]
}

const APP_KEY_VARIABLE = 'BREW_API_KEY'

/** Env files a framework may load (and so may inline into a bundle). */
function envFiles(root: string): string[] {
  try {
    return readdirSync(root)
      .filter((name) => name === '.env' || name.startsWith('.env.'))
      .filter((name) => name !== '.env.example' && !name.endsWith('.sample'))
      .sort()
  } catch {
    return []
  }
}

/** The installed SDK's version, looking up from the app (hoisted installs). */
function installedSdkVersion(root: string): string | null {
  let dir = root
  for (let depth = 0; depth < 8; depth += 1) {
    const text = readTextFile(
      join(dir, 'node_modules', SDK_PACKAGE, 'package.json')
    )
    if (text !== null) {
      try {
        const version = (JSON.parse(text) as { version?: unknown }).version
        return typeof version === 'string' ? version : null
      } catch {
        return null
      }
    }
    const parent = dirname(dir)
    if (parent === dir) {
      break
    }
    dir = parent
  }
  return null
}

function declaredSdkRange(root: string): {
  hasPackageJson: boolean
  range: string | null
} {
  const text = readTextFile(join(root, 'package.json'))
  if (text === null) {
    return { hasPackageJson: false, range: null }
  }
  try {
    const pkg = JSON.parse(text) as Record<string, unknown>
    for (const field of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
    ]) {
      const deps = pkg[field]
      if (typeof deps === 'object' && deps !== null) {
        const range = (deps as Record<string, unknown>)[SDK_PACKAGE]
        if (typeof range === 'string') {
          return { hasPackageJson: true, range }
        }
      }
    }
  } catch {
    // An unreadable package.json reads as "not declared".
  }
  return { hasPackageJson: true, range: null }
}

function describe(error: unknown): string {
  if (error instanceof BrewApiError || error instanceof CliApiError) {
    return `${error.status} ${error.code}: ${error.message}`
  }
  return error instanceof Error ? error.message : String(error)
}

export async function runProjectDoctor(
  ctx: CliContext
): Promise<ProjectDoctorReport> {
  const root = resolveCwd(ctx.io)
  const checks: ProjectCheck[] = []
  const stateText = readTextFile(join(root, BREW_STATE_FILE))
  if (stateText === null) {
    throw new CliUsageError(
      `No ${BREW_STATE_FILE} in ${root}. Run doctor --project in the app init set up (or run init there first).`
    )
  }
  const parsed = parseBrewState(stateText)
  if (!parsed.ok) {
    checks.push({
      id: 'state',
      status: 'fail',
      detail: `${BREW_STATE_FILE} is not valid`,
      items: parsed.errors,
      fix: `Fix ${BREW_STATE_FILE} by hand or remove it and run init again.`,
    })
    return { ok: false, root, brandId: null, apiKey: null, checks }
  }
  const state: BrewProjectState = parsed.state
  checks.push({
    id: 'state',
    status: 'ok',
    detail: `${BREW_STATE_FILE} is valid (${Object.keys(state.emails).length} keys, ${Object.keys(state.files).length} managed files)`,
  })

  // ---- Managed files: still what init wrote?
  const modified: string[] = []
  const missing: string[] = []
  for (const [path, entry] of Object.entries(state.files)) {
    const text = readTextFile(join(root, path))
    if (text === null) {
      missing.push(path)
    } else if (sha256Hex(text) !== entry.sha256) {
      modified.push(path)
    }
  }
  checks.push(
    missing.length > 0
      ? {
          id: 'files',
          status: 'fail',
          detail: `${missing.length} managed file(s) missing`,
          items: missing,
          fix: 'Run init again to recreate them (it never overwrites a file you edited).',
        }
      : modified.length > 0
        ? {
            id: 'files',
            status: 'warn',
            detail: `${modified.length} managed file(s) edited since init wrote them (init keeps your version)`,
            items: modified,
          }
        : {
            id: 'files',
            status: 'ok',
            detail: `${Object.keys(state.files).length} managed file(s) unchanged`,
          }
  )

  // ---- The app key: present, and never under a browser-exposed name.
  const files = envFiles(root)
  const envLocalText = readTextFile(join(root, '.env.local'))
  const envLocalValue = (name: string): string | undefined => {
    const value =
      envLocalText === null
        ? undefined
        : getEnvValue(parseEnv(envLocalText), name)
    return value === undefined || value.trim() === '' ? undefined : value.trim()
  }
  const envLocalKey = envLocalValue(APP_KEY_VARIABLE)
  const processKey = ctx.io.env[APP_KEY_VARIABLE]?.trim() || undefined
  checks.push(
    envLocalKey !== undefined
      ? {
          id: 'env',
          status: 'ok',
          detail: `${APP_KEY_VARIABLE} is set in .env.local`,
        }
      : processKey !== undefined
        ? {
            id: 'env',
            status: 'warn',
            detail: `${APP_KEY_VARIABLE} comes from the environment, not .env.local`,
          }
        : {
            id: 'env',
            status: 'fail',
            detail: `${APP_KEY_VARIABLE} is not set in .env.local`,
            fix: 'Run init again (it signs in and writes the app key), or add the key to .env.local.',
          }
  )
  const exposed: string[] = []
  // A key: a value shaped like one, the app key itself, or any value under
  // a Brew key-like name. A URL or an empty placeholder is not one.
  const looksLikeKey = (name: string, value: string): boolean =>
    isClientExposedName(name) &&
    value !== '' &&
    (/BREW.*(?:KEY|SECRET|TOKEN)/i.test(name) ||
      value.startsWith('brew_') ||
      (envLocalKey !== undefined && value === envLocalKey))
  for (const file of files) {
    const text = readTextFile(join(root, file))
    if (text === null) {
      continue
    }
    for (const line of parseEnv(text).lines) {
      if (
        line.kind === 'var' &&
        looksLikeKey(
          line.key,
          getEnvValue(parseEnv(text), line.key)?.trim() ?? ''
        )
      ) {
        exposed.push(`${file}: ${line.key}`)
      }
    }
  }
  // The shell or CI can hand the build a public name too.
  for (const [name, value] of Object.entries(ctx.io.env)) {
    if (looksLikeKey(name, value?.trim() ?? '')) {
      exposed.push(`environment: ${name}`)
    }
  }
  checks.push(
    exposed.length > 0
      ? {
          id: 'env-exposure',
          status: 'fail',
          detail:
            'a Brew key sits under a browser-exposed name (NEXT_PUBLIC_, VITE_, PUBLIC_, EXPO_PUBLIC_): it ships to every visitor',
          items: exposed,
          fix: `Rename it to ${APP_KEY_VARIABLE}, use it from server code only, and revoke the exposed key in Brew (Settings > API keys).`,
        }
      : {
          id: 'env-exposure',
          status: 'ok',
          detail: 'no Brew key under a browser-exposed name',
        }
  )
  let ignored = false
  try {
    ignored = await isIgnored('.env.local', {
      cwd: root,
      spawn: resolveSpawn(ctx.io),
      signal: ctx.signal,
    })
  } catch {
    ctx.signal.throwIfAborted()
  }
  checks.push(
    ignored
      ? { id: 'gitignore', status: 'ok', detail: '.env.local is git-ignored' }
      : {
          id: 'gitignore',
          status: 'fail',
          detail:
            '.env.local is not git-ignored: the app key is one `git add` from a commit',
          fix: 'Add .env.local to .gitignore (and `git rm --cached .env.local` if git tracks it).',
        }
  )

  // ---- The SDK.
  const declared = declaredSdkRange(root)
  if (!declared.hasPackageJson) {
    checks.push({
      id: 'sdk',
      status: 'skipped',
      detail: `no package.json (Edge Functions import npm:${SDK_PACKAGE}@${SDK_RANGE})`,
    })
  } else if (
    state.framework === 'vite-react' ||
    state.framework === 'supabase-functions'
  ) {
    // init installs no SDK where the app's own code never sends.
    checks.push({
      id: 'sdk',
      status: 'skipped',
      detail:
        state.framework === 'vite-react'
          ? 'browser-only app: send from your server or Supabase Edge Functions'
          : `Edge Functions import npm:${SDK_PACKAGE}@${SDK_RANGE}`,
    })
  } else if (declared.range === null) {
    checks.push({
      id: 'sdk',
      status: 'fail',
      detail: `${SDK_PACKAGE} is not a dependency`,
      fix: `Install ${SDK_PACKAGE}@${SDK_RANGE}.`,
    })
  } else if (!reachesSdkRange(declared.range)) {
    checks.push({
      id: 'sdk',
      status: 'fail',
      detail: `${SDK_PACKAGE} ${declared.range} is older than the ${SDK_RANGE} the generated files need`,
      fix: `Install ${SDK_PACKAGE}@${SDK_RANGE}.`,
    })
  } else {
    const installed = installedSdkVersion(root)
    checks.push(
      installed === null
        ? {
            id: 'sdk',
            status: 'warn',
            detail: `${SDK_PACKAGE} ${declared.range} is declared but not installed`,
            fix: 'Run your package manager install.',
          }
        : reachesSdkRange(installed)
          ? {
              id: 'sdk',
              status: 'ok',
              detail: `${SDK_PACKAGE} ${installed} installed (needs ${SDK_RANGE})`,
            }
          : {
              id: 'sdk',
              status: 'fail',
              detail: `${SDK_PACKAGE} ${installed} is installed, older than ${SDK_RANGE}`,
              fix: 'Run your package manager install (the lockfile pins an old version).',
            }
    )
  }

  // ---- The brand's side, with the app's key.
  const auth = resolveProjectAuth(ctx, {
    envLocalKey,
    envLocalApiUrl: envLocalValue(API_URL_VARIABLE),
    state,
  })
  if (auth === undefined) {
    for (const id of ['auth', 'app-emails', 'domain', 'provider'] as const) {
      checks.push({
        id,
        status: 'skipped',
        detail: `no API key (set ${APP_KEY_VARIABLE} in .env.local)`,
      })
    }
    return finish(root, state, null, checks)
  }
  const client = buildSdkClient(auth, sdkTransportFor(ctx))
  try {
    const brand = await client.brand.get()
    checks.push(
      state.brandId !== undefined && brand.brandId !== state.brandId
        ? {
            id: 'auth',
            status: 'fail',
            detail: `the key's brand (${brand.brandId}) is not brew.json's (${state.brandId})`,
            fix: 'Use the app key init wrote, or run init again to re-link the project.',
          }
        : {
            id: 'auth',
            status: 'ok',
            detail: `key ${maskApiKey(auth.apiKey)} reaches ${brand.identity?.brandName ?? brand.domain ?? brand.brandId}`,
          }
    )
  } catch (error) {
    ctx.signal.throwIfAborted()
    checks.push({
      id: 'auth',
      status: 'fail',
      detail: `the key does not work: ${describe(error)}`,
      fix: 'Run init again to sign in and write a fresh app key.',
    })
    for (const id of ['app-emails', 'domain', 'provider'] as const) {
      checks.push({ id, status: 'skipped', detail: 'the key does not work' })
    }
    return finish(root, state, auth, checks)
  }
  checks.push(await checkAppEmails(ctx, client, state))
  checks.push(await checkDomain(ctx, client))
  checks.push(...(await checkProviders(ctx, client, state)))
  return finish(root, state, auth, checks)
}

function finish(
  root: string,
  state: BrewProjectState,
  auth: ResolvedAuth | null,
  checks: readonly ProjectCheck[]
): ProjectDoctorReport {
  return {
    ok: !checks.some((check) => check.status === 'fail'),
    root,
    brandId: state.brandId ?? null,
    apiKey: auth === null ? null : maskApiKey(auth.apiKey),
    checks,
  }
}

/**
 * The key to check with: `--api-key` / `BREW_API_KEY` first, then the app
 * key in `.env.local` (bound to its brand: sent without X-Brand-Id), then
 * the stored CLI login.
 */
function resolveProjectAuth(
  ctx: CliContext,
  input: {
    readonly envLocalKey: string | undefined
    /** The server the .env.local key is for (BREW_API_URL beside it). */
    readonly envLocalApiUrl: string | undefined
    readonly state: BrewProjectState
  }
): ResolvedAuth | undefined {
  const resolved = resolveAuth({
    globals: ctx.globals,
    env: ctx.io.env,
    allowAnonymous: true,
  })
  if (resolved.apiKeySource === 'flag' || resolved.apiKeySource === 'env') {
    return { ...resolved, brandId: resolved.brandId ?? input.state.brandId }
  }
  if (input.envLocalKey !== undefined) {
    // The key goes only to the server it is for (none saved = the default);
    // another server named explicitly is refused before any request.
    const saved = input.envLocalApiUrl ?? DEFAULT_API_URL
    const named =
      ctx.globals.apiUrl ?? (ctx.io.env.BREW_API_URL?.trim() || undefined)
    if (
      named !== undefined &&
      named.replace(/\/+$/, '') !== saved.replace(/\/+$/, '')
    ) {
      throw new CliUsageError(
        `${APP_KEY_VARIABLE} in .env.local is for ${saved}, not ${named}: run doctor --project without --api-url and BREW_API_URL (or with ${saved}).`
      )
    }
    return {
      apiKey: input.envLocalKey,
      apiKeySource: 'env',
      brandId: ctx.globals.brand,
      apiUrl: saved,
    }
  }
  if (resolved.apiKeySource === 'config') {
    return { ...resolved, brandId: input.state.brandId ?? resolved.brandId }
  }
  return undefined
}

async function checkAppEmails(
  ctx: CliContext,
  client: BrewClient,
  state: BrewProjectState
): Promise<ProjectCheck> {
  const keys = Object.keys(state.emails).sort()
  if (keys.length === 0) {
    return {
      id: 'app-emails',
      status: 'skipped',
      detail: 'brew.json lists no keys',
    }
  }
  // `readiness` is how a fire sends now: a draft over a live version still
  // sends, a published key without a domain of its purpose does not.
  const rows = new Map<
    string,
    {
      triggerEventId: string
      readiness: {
        ready: boolean
        teamOnly: boolean
        blockers: readonly string[]
      }
    }
  >()
  try {
    // Every page until each brew.json key is found (a repeated cursor ends it).
    let cursor: string | undefined
    const seen = new Set<string>()
    for (;;) {
      ctx.signal.throwIfAborted()
      const result = await client.appEmails.list({
        limit: 100,
        ...(cursor === undefined ? {} : { cursor }),
      })
      for (const row of result.data) {
        rows.set(row.triggerKey, {
          triggerEventId: row.triggerEventId,
          readiness: row.readiness,
        })
      }
      const next = result.pagination.cursor
      if (
        keys.every((key) => rows.has(key)) ||
        !result.pagination.hasMore ||
        next === null ||
        seen.has(next)
      ) {
        break
      }
      seen.add(next)
      cursor = next
    }
  } catch (error) {
    ctx.signal.throwIfAborted()
    return {
      id: 'app-emails',
      status: 'fail',
      detail: `could not list app emails: ${describe(error)}`,
    }
  }
  const missing = keys.filter((key) => !rows.has(key))
  const moved = keys.filter(
    (key) =>
      rows.has(key) &&
      rows.get(key)?.triggerEventId !== state.emails[key]?.triggerEventId
  )
  const blocked = keys.filter((key) => rows.get(key)?.readiness.ready === false)
  if (missing.length > 0) {
    return {
      id: 'app-emails',
      status: 'fail',
      detail: `${missing.length} key(s) in brew.json have no app email in this brand: sends answer TRIGGER_KEY_NOT_FOUND`,
      items: missing,
      fix: 'Run init again (it sets the kit up idempotently), or `app-emails upsert <key>`.',
    }
  }
  if (blocked.length > 0) {
    return {
      id: 'app-emails',
      status: 'fail',
      detail: `${blocked.length} key(s) cannot send: ${blocked.map((key) => `${key} (${rows.get(key)?.readiness.blockers.join(', ')})`).join('; ')}`,
      items: blocked,
      fix: 'Publish their automations in Brew (or run `app-emails upsert <key> --yes`); DOMAIN_REQUIRED needs a verified domain of their purpose.',
    }
  }
  // A verified domain of the other purpose leaves a key in the sandbox.
  const teamOnly = keys.filter(
    (key) => rows.get(key)?.readiness.teamOnly === true
  )
  if (teamOnly.length > 0) {
    return {
      id: 'app-emails',
      status: 'warn',
      detail: `${teamOnly.length} key(s) reach your Brew team only (sandbox): no verified domain of their purpose (transactional for auth emails)`,
      items: teamOnly,
      fix: 'Verify a domain of their purpose, then run init again: their sender moves to it.',
    }
  }
  return moved.length > 0
    ? {
        id: 'app-emails',
        status: 'warn',
        detail: `${moved.length} key(s) now point at another trigger than brew.json records (run init again to refresh it)`,
        items: moved,
      }
    : {
        id: 'app-emails',
        status: 'ok',
        detail: `${keys.length} key(s) set up and ready to send`,
      }
}

async function checkDomain(
  ctx: CliContext,
  client: BrewClient
): Promise<ProjectCheck> {
  try {
    // Every page: a verified domain past the first is still the sender.
    const rows = await collectAll(ctx, (cursor) =>
      client.domains.list({
        limit: 100,
        ...(cursor === undefined ? {} : { cursor }),
      })
    )
    const sending = rows.find(
      (row) => row.status === 'verified' && row.sendable
    )
    if (sending !== undefined) {
      return {
        id: 'domain',
        status: 'ok',
        detail: `sending from ${sending.name}`,
      }
    }
    const pending = rows.map((row) => `${row.name} (${row.status})`)
    return {
      id: 'domain',
      status: 'warn',
      detail:
        'no verified sending domain: app emails reach your Brew team only (sandbox)',
      ...(pending.length === 0 ? {} : { items: pending }),
      fix: 'Add the DNS records for a domain (or Connect automatically on its page in Brew), then `domains verify <domainId>`.',
    }
  } catch (error) {
    ctx.signal.throwIfAborted()
    return {
      id: 'domain',
      status: 'fail',
      detail: `could not list domains: ${describe(error)}`,
    }
  }
}

async function checkProviders(
  ctx: CliContext,
  client: BrewClient,
  state: BrewProjectState
): Promise<ProjectCheck[]> {
  const providers = new Set<HostedAuthProvider>()
  if (state.auth?.startsWith('supabase') === true) {
    providers.add('supabase_auth')
  }
  if (state.auth?.startsWith('clerk') === true) {
    providers.add('clerk')
  }
  for (const key of Object.keys(state.providerConfig ?? {})) {
    if (key === 'supabase_auth' || key === 'clerk') {
      providers.add(key)
    }
  }
  if (providers.size === 0) {
    return [
      {
        id: 'provider',
        status: 'skipped',
        detail: 'no hosted auth hook for this auth stack',
      },
    ]
  }
  const checks: ProjectCheck[] = []
  for (const provider of providers) {
    try {
      const connection = await findConnection(client, provider)
      checks.push(
        connection === null
          ? {
              id: 'provider',
              status: 'warn',
              detail: `${provider}: not connected (the provider sends its own auth emails, or a self-hosted hook does)`,
              fix: `\`integrations connect ${provider}\`, or init's manual steps.`,
            }
          : connection.status === 'active'
            ? {
                id: 'provider',
                status: 'ok',
                detail: `${provider}: active (${connection.webhookUrl})`,
              }
            : {
                id: 'provider',
                status: 'warn',
                detail: `${provider}: ${connection.status} until the first signed delivery; check the provider points at ${connection.webhookUrl}`,
              }
      )
    } catch (error) {
      ctx.signal.throwIfAborted()
      checks.push({
        id: 'provider',
        status: 'fail',
        detail: `${provider}: could not read the connection: ${describe(error)}`,
      })
    }
  }
  return checks
}
