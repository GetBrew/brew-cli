import { BrewApiError } from '@brew.new/sdk'
import type { BrewClient } from '../client'
import { systemClock } from '../clock'
import { CliApiError } from '../errors'
import { progress } from '../output'
import type { CliContext } from '../types'
import type { InitReport, InitStep, NextStep } from './report'

/**
 * `init --app-url`: the brand whose website is the app's. A brand that
 * matches is used as it is; with a credential that may pick or create
 * brands (an organization key from `--api-key` / `BREW_API_KEY`), init
 * picks the matching brand, or creates one from the app's URL through
 * `POST /v1/brands` (organization-scoped keys with the `brands` scope
 * only; `403` otherwise, answered with what to do instead). A key bound to
 * one brand (a fresh sign-in, the app key in `.env.local`) is never moved:
 * a mismatch is reported, never "fixed" by sending the kit elsewhere.
 * Idempotent: a re-run finds the brand it created by its website.
 */

export type AppBrand = NonNullable<InitReport['brand']>

/** How long init waits for a brand it created to finish extraction. */
export const BRAND_READY_TIMEOUT_MS = 180_000
const BRAND_POLL_MS = 5000

/** `acme.com` from `https://www.acme.com/x`, `acme.com`, or `ACME.com`. */
export function normalizeHost(value: string): string | null {
  const text = value.trim().toLowerCase()
  if (text === '') {
    return null
  }
  try {
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//.test(text) ? text : `https://${text}`
    )
    return url.hostname.replace(/^www\./, '').replace(/\.$/, '') || null
  } catch {
    return null
  }
}

/**
 * The app is the brand's when its host is the brand's website or a
 * subdomain of it (`app.acme.com` belongs to `acme.com`).
 */
export function brandMatchesApp(
  brandDomain: string | null | undefined,
  appUrl: string
): boolean {
  const app = normalizeHost(appUrl)
  const brand =
    brandDomain === null || brandDomain === undefined
      ? null
      : normalizeHost(brandDomain)
  return (
    app !== null &&
    brand !== null &&
    (app === brand || app.endsWith(`.${brand}`))
  )
}

export type BrandResolution = {
  readonly brand: AppBrand | null
  /** The brand the run's credential should act on from here, when it changed. */
  readonly switchTo?: string
  /** False while a brand init created is still extracting. */
  readonly ready: boolean
  readonly step: InitStep
  readonly nextSteps: readonly NextStep[]
}

function isForbidden(error: unknown): error is BrewApiError | CliApiError {
  return (
    (error instanceof BrewApiError || error instanceof CliApiError) &&
    error.status === 403
  )
}

export async function resolveAppBrand(input: {
  readonly ctx: CliContext
  readonly client: BrewClient
  readonly appUrl: string
  /** The brand the credential acts on now, if it resolved to one. */
  readonly current: AppBrand | null
  /** `current`'s `ready` (`GET /v1/brand`). */
  readonly currentReady: boolean
  /** False for a key bound to one brand (sign-in, `.env.local`). */
  readonly canSwitch: boolean
  readonly dryRun: boolean
  readonly noWait: boolean
  readonly idempotencyKey: (body: unknown) => string
  readonly siteUrl: string
  readonly rerunCommand: string
}): Promise<BrandResolution> {
  const { ctx, client, appUrl, current } = input
  const host = normalizeHost(appUrl) ?? appUrl
  const nextSteps: NextStep[] = []
  if (current !== null && brandMatchesApp(current.domain, appUrl)) {
    // A brand a `--no-wait` run created may still be extracting.
    const ready =
      input.currentReady || (await waitForBrand(input, current.brandId))
    return {
      brand: { ...current, matchesAppUrl: true, created: false },
      ready,
      step: {
        id: 'brand',
        status: 'done',
        detail: `${current.name ?? current.brandId} (matches ${host})${ready ? '' : ' (still extracting)'}`,
      },
      nextSteps: ready ? nextSteps : [extracting(input.rerunCommand, host)],
    }
  }
  const mismatch = (detail: string): BrandResolution => {
    nextSteps.push({
      id: 'brand-app-url',
      actor: 'human',
      kind: 'open-url',
      url: `${input.siteUrl}/brands`,
      title: detail,
      blocking: current === null,
    })
    return {
      brand:
        current === null
          ? null
          : { ...current, matchesAppUrl: false, created: false },
      ready: current !== null,
      step:
        current === null
          ? { id: 'brand', status: 'failed', detail: `no brand for ${host}` }
          : {
              id: 'brand',
              status: 'done',
              detail: `${current.name ?? current.brandId} (does not match ${host})`,
            },
      nextSteps,
    }
  }
  if (!input.canSwitch) {
    return mismatch(
      `This app is at ${host}, but its key is for ${current?.name ?? 'another brand'}${current?.domain ? ` (${current.domain})` : ''}. Keep it if that is this app's brand. Otherwise create a brand for ${host} in Brew, remove BREW_API_KEY from .env.local, and run init again, picking that brand when you approve the sign-in`
    )
  }

  // An organization key: pick the brand with the app's website, or make one.
  let match:
    | {
        readonly brandId: string
        readonly domain: string
        readonly ready: boolean
      }
    | undefined
  try {
    // Every page until a match or the list's end (a cursor seen before
    // ends it too): a match past any fixed page count would be re-created
    // and refused as BRAND_DOMAIN_CONFLICT.
    let cursor: string | undefined
    const seen = new Set<string>()
    while (match === undefined) {
      const result = await client.brands.list({
        limit: 100,
        ...(cursor === undefined ? {} : { cursor }),
      })
      match = result.data.find(
        (row) =>
          row.status !== 'deleting' &&
          row.status !== 'failed' &&
          brandMatchesApp(row.domain, appUrl)
      )
      const next = result.pagination.cursor
      if (!result.pagination.hasMore || next === null || seen.has(next)) {
        break
      }
      seen.add(next)
      cursor = next
    }
  } catch (error) {
    ctx.signal.throwIfAborted()
    if (isForbidden(error)) {
      throw error
    }
    // Not a mismatch: the app's brand is unknown, so nothing brand-specific
    // runs in the brand the key acts as now.
    return {
      brand: null,
      ready: false,
      step: {
        id: 'brand',
        status: 'failed',
        detail: `could not list brands: ${describe(error)}`,
      },
      nextSteps: [
        {
          id: 'brand-app-url',
          actor: 'human',
          kind: 'open-url',
          url: `${input.siteUrl}/brands`,
          title: `Could not list brands (${describe(error)}); run init again, or pick the brand for ${host} with --brand <brandId>`,
          blocking: true,
        },
      ],
    }
  }
  let created = false
  let brandId = match?.brandId
  let ready = match?.ready ?? false
  let domain = match?.domain ?? host
  if (brandId === undefined) {
    if (input.dryRun) {
      return {
        brand: current === null ? null : { ...current, matchesAppUrl: false },
        ready: false,
        step: {
          id: 'brand',
          status: 'planned',
          detail: `create a brand for ${host} (POST /v1/brands; organization keys only)`,
        },
        nextSteps,
      }
    }
    const body = { url: appUrl }
    try {
      progress(
        ctx,
        `Creating a brand for ${host} (Brew reads the site for its design)…`
      )
      const brand = await client.brands.create(body, {
        idempotencyKey: input.idempotencyKey(body),
      })
      brandId = brand.brandId
      ready = brand.ready
      domain = brand.domain
      created = true
    } catch (error) {
      ctx.signal.throwIfAborted()
      if (isForbidden(error)) {
        return mismatch(
          `Creating a brand for ${host} needs an organization API key with the brands scope (${error.code}). Create the brand in Brew (Brands > New brand, ${host}), or run init with an organization key: BREW_API_KEY=<org key> ${input.rerunCommand}`
        )
      }
      if (error instanceof BrewApiError || error instanceof CliApiError) {
        if (error.status === 401) {
          throw error
        }
        return mismatch(
          `Could not create a brand for ${host} (${describe(error)}); create it in Brew, then run init again`
        )
      }
      throw error
    }
  }
  if (!ready) {
    ready = await waitForBrand(input, brandId)
  }
  const name = domain
  if (!ready) {
    nextSteps.push(extracting(input.rerunCommand, host))
  }
  return {
    brand: { brandId, name, domain, matchesAppUrl: true, created },
    ...(brandId === current?.brandId ? {} : { switchTo: brandId }),
    ready,
    step: {
      id: 'brand',
      status: 'done',
      detail: `${created ? 'created' : 'using'} ${domain} for ${host}${ready ? '' : ' (still extracting)'}`,
    },
    nextSteps,
  }
}

function extracting(rerunCommand: string, host: string): NextStep {
  return {
    id: 'brand-extracting',
    actor: 'agent',
    kind: 'run-command',
    command: rerunCommand,
    title: `Brew is still reading ${host} to build the brand (1 to 3 minutes); run init again when it is ready`,
    blocking: true,
  }
}

/** Polls `GET /v1/brands/{brandId}` until `ready`, a failure, or the bound. */
async function waitForBrand(
  input: {
    readonly ctx: CliContext
    readonly client: BrewClient
    readonly noWait: boolean
  },
  brandId: string
): Promise<boolean> {
  if (input.noWait) {
    return false
  }
  const clock = input.ctx.io.clock ?? systemClock
  const deadline = clock.now() + BRAND_READY_TIMEOUT_MS
  progress(input.ctx, 'Waiting for the brand to be ready (up to 3 minutes)…')
  while (clock.now() < deadline) {
    await clock.sleep(BRAND_POLL_MS, input.ctx.signal)
    const status = await input.client.brands.get({ brandId })
    if (status.ready) {
      return true
    }
    if (status.status === 'failed') {
      return false
    }
  }
  return false
}

function describe(error: unknown): string {
  if (error instanceof BrewApiError || error instanceof CliApiError) {
    return `${error.code}: ${error.message}`
  }
  return error instanceof Error ? error.message : String(error)
}
