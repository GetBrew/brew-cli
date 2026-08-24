import type { CreateBrandInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  requestOptions,
  toStringArray,
} from '../../lib/input'

export const brandsCreateCommand = defineCommand({
  path: ['brands', 'create'],
  summary:
    'Create a brand and start async extraction (needs an ORGANIZATION-scoped key); poll `brands get` until ready',
  sdkMethod: 'brands.create',
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
      data: await ctx
        .client()
        .brands.create(
          asSdkInput<CreateBrandInput>(input),
          requestOptions(flags)
        ),
    }
  },
})
