import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  toStringArray,
} from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type BrandsCreateResponse = components['schemas']['BrandsCreateResponse']

export const brandsCreateCommand = defineCommand({
  path: ['brands', 'create'],
  summary:
    'Create a brand and start async extraction (needs an ORGANIZATION-scoped key); poll `brands get` until ready',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/brands' },
  commandClass: 'write',
  flags: [
    { flag: '--url <url>', summary: 'Website to extract the brand from' },
    {
      flag: '--instructions <text>',
      summary: 'Guidance for the extraction (tone sources, brand color, …)',
    },
    {
      flag: '--include-paths <paths...>',
      summary: 'Site path(s) the crawl must include, repeatable',
    },
    {
      flag: '--exclude-paths <paths...>',
      summary: 'Site path(s) the crawl must skip, repeatable',
    },
    {
      flag: '--exclude-subdomains <subdomains...>',
      summary: 'Subdomain(s) the crawl must skip, repeatable',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli brands create --url acme.com',
    'brew-cli brands create --url acme.com --instructions "Primary brand color is the deep navy in the header"',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      url: flagString(flags.url),
      instructions: flagString(flags.instructions),
      includePaths: toStringArray(flags.includePaths),
      excludePaths: toStringArray(flags.excludePaths),
      excludeSubdomains: toStringArray(flags.excludeSubdomains),
    })
    if (typeof input.url !== 'string' || input.url === '') {
      throw new CliUsageError('--url is required (or provide it via --input).')
    }
    return {
      data: await rawRequest<BrandsCreateResponse>(ctx, {
        method: 'POST',
        path: '/v1/brands',
        body: input,
        idempotencyKey: flagString(flags.idempotencyKey),
      }),
    }
  },
})
