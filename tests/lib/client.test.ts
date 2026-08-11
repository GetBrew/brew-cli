import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import {
  buildSdkClient,
  isOrgLevelPath,
  maskApiKey,
} from '../../src/lib/client'
import { server } from '../helpers/msw-server'

const AUTH = {
  apiKey: 'brew_abcdefghijklmnopqrstuvwxyz012345',
  apiKeySource: 'env',
  brandId: 'bd_42',
  apiUrl: 'https://brew.new/api',
} as const

describe('brand header bridge (SDK 8.0.0 withBrand shim)', () => {
  it('injects X-Brand-Id on brand-scoped SDK calls', async () => {
    let brandHeader: string | null = null
    server.use(
      http.get('https://brew.new/api/v1/fields', ({ request }) => {
        brandHeader = request.headers.get('x-brand-id')
        return HttpResponse.json({ fields: [] })
      })
    )
    await buildSdkClient(AUTH).fields.list()
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
    await buildSdkClient(AUTH).usage.get()
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
    await buildSdkClient(AUTH).usage.get()
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
})

describe('maskApiKey', () => {
  it('keeps only a recognizable prefix and suffix', () => {
    expect(maskApiKey('brew_abcdefghijklmnopqrstuvwxyz012345')).toBe(
      'brew_abc…345'
    )
    expect(maskApiKey('short')).toBe('short…')
  })
})
