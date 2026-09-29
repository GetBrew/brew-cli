import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import {
  buildSdkClient,
  isOrgLevelPath,
  maskApiKey,
  type SdkTransport,
} from '../../src/lib/client'
import { server } from '../helpers/msw-server'

const AUTH = {
  apiKey: 'brew_abcdefghijklmnopqrstuvwxyz012345',
  apiKeySource: 'env',
  brandId: 'bd_42',
  apiUrl: 'https://brew.new/api',
} as const

function transport(overrides: Partial<SdkTransport> = {}): SdkTransport {
  return {
    signal: new AbortController().signal,
    fetch: (input, init) => globalThis.fetch(input, init),
    timeoutMs: undefined,
    maxRetries: undefined,
    ...overrides,
  }
}

describe('brand header bridge (SDK 8.0.0 withBrand shim)', () => {
  it('injects X-Brand-Id on brand-scoped SDK calls', async () => {
    let brandHeader: string | null = null
    server.use(
      http.get('https://brew.new/api/v1/fields', ({ request }) => {
        brandHeader = request.headers.get('x-brand-id')
        return HttpResponse.json({ fields: [] })
      })
    )
    await buildSdkClient(AUTH, transport()).fields.list()
    expect(brandHeader).toBe('bd_42')
  })

  it('never injects X-Brand-Id on organization-level SDK calls', async () => {
    let brandHeader: string | null = null
    server.use(
      http.get('https://brew.new/api/v1/usage', ({ request }) => {
        brandHeader = request.headers.get('x-brand-id')
        return HttpResponse.json({ plan: 'growth' })
      })
    )
    await buildSdkClient(AUTH, transport()).usage.get()
    expect(brandHeader).toBeNull()
  })

  it('sends the CLI user agent', async () => {
    let userAgent: string | null = null
    server.use(
      http.get('https://brew.new/api/v1/usage', ({ request }) => {
        userAgent = request.headers.get('user-agent')
        return HttpResponse.json({ plan: 'growth' })
      })
    )
    await buildSdkClient(AUTH, transport()).usage.get()
    expect(userAgent).toContain('brew-cli/')
  })
})

describe('isOrgLevelPath', () => {
  it('classifies org-level and brand-scoped paths', () => {
    expect(isOrgLevelPath('https://brew.new/api/v1/usage')).toBe(true)
    expect(isOrgLevelPath('/v1/templates')).toBe(true)
    expect(isOrgLevelPath('/v1/health')).toBe(true)
    expect(isOrgLevelPath('/v1/fields')).toBe(false)
    expect(isOrgLevelPath('https://brew.new/api/v1/contacts/search')).toBe(
      false
    )
  })

  it('boundary-matches and ignores query strings', () => {
    expect(isOrgLevelPath('/v1/usage-report')).toBe(false)
    expect(isOrgLevelPath('/v1/usagefoo')).toBe(false)
    expect(isOrgLevelPath('/v1/healthz')).toBe(false)
    expect(isOrgLevelPath('/v1/brand')).toBe(false)
    expect(isOrgLevelPath('/v1/brands/bd_1')).toBe(true)
    expect(isOrgLevelPath('/v1/contacts/search?next=/api/v1/usage')).toBe(false)
    expect(isOrgLevelPath('https://brew.new/api/v1/usage?verbose=1')).toBe(true)
  })
})

describe('maskApiKey', () => {
  it('keeps only a recognizable prefix and suffix', () => {
    expect(maskApiKey('brew_abcdefghijklmnopqrstuvwxyz012345')).toBe(
      'brew_abc…345'
    )
    expect(maskApiKey('short')).toBe('sho…')
    expect(maskApiKey('brew_abcdef')).toBe('bre…')
  })
})

describe('buildSdkClient transport', () => {
  it('cancels every call through the client-level signal', async () => {
    server.use(
      http.get(
        'https://brew.new/api/v1/usage',
        () => new Promise<Response>(() => undefined)
      )
    )
    const controller = new AbortController()
    const pending = buildSdkClient(
      AUTH,
      transport({ signal: controller.signal })
    ).usage.get()
    controller.abort(new Error('stop'))
    await expect(pending).rejects.toThrow('stop')
  })

  it('sends every attempt through the transport fetch', async () => {
    const seen: string[] = []
    server.use(
      http.get('https://brew.new/api/v1/usage', () =>
        HttpResponse.json({ plan: 'growth' })
      )
    )
    await buildSdkClient(
      AUTH,
      transport({
        fetch: (input, init) => {
          seen.push(String(input))
          return globalThis.fetch(input, init)
        },
      })
    ).usage.get()
    expect(seen).toEqual(['https://brew.new/api/v1/usage'])
  })

  it('applies --max-retries to the SDK retry loop', async () => {
    let calls = 0
    server.use(
      http.get('https://brew.new/api/v1/usage', () => {
        calls += 1
        return new HttpResponse(null, { status: 503 })
      })
    )
    await expect(
      buildSdkClient(AUTH, transport({ maxRetries: 0 })).usage.get()
    ).rejects.toThrow()
    expect(calls).toBe(1)
  })
})
