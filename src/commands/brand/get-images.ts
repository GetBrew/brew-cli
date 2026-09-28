import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import {
  flagInt,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'
import { renderTable } from '../../lib/output'
import {
  ALL_FLAG,
  CURSOR_FLAG,
  collectAll,
  LIMIT_FLAG,
} from '../../lib/paginate'
import { rawRequest } from '../../lib/raw-request'

type BrandImagesPage =
  operations['getBrandImages']['responses'][200]['content']['application/json']

/**
 * The brand's asset library, as the Assets page in the Brew app shows it:
 * logos, brand images and images made with Brew. Raw route because
 * `@brew.new/sdk` 10's `brand.getImages` forwards only the retired
 * `type` / `aspectRatio` filters: once the CLI adopts the SDK release that
 * forwards `kind` and `sort`, bind `brand.getImages` here and drop
 * `isRawTransport` (and its `SDK_SKIP_LIST` entry).
 */
export const brandGetImagesCommand = defineCommand({
  path: ['brand', 'get-images'],
  summary:
    "List or semantically search the brand's assets: logos, brand images and images made with Brew",
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/brand/images' },
  commandClass: 'read',
  flags: [
    {
      flag: '--query <text>',
      summary:
        'Semantic search over brand and generated images (1 credit per new search; relevance order)',
    },
    {
      flag: '--kind <kind>',
      summary: 'logo, brand (site or uploaded) or generated (made with Brew)',
    },
    {
      flag: '--sort <order>',
      summary: 'newest (default) or oldest; ignored with --query',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli brand get-images',
    'brew-cli brand get-images --kind generated --sort oldest',
    'brew-cli brand get-images --query "team photo" --kind brand',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      q: flagString(flags.query),
      kind: flagString(flags.kind),
      sort: flagString(flags.sort),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    }) as Record<string, unknown>
    const fetchPage = (cursor: string | undefined) =>
      rawRequest<BrandImagesPage>(ctx, {
        method: 'GET',
        path: '/v1/brand/images',
        query: {
          q: flagString(input.q),
          kind: flagString(input.kind),
          sort: flagString(input.sort),
          limit: input.limit === undefined ? undefined : String(input.limit),
          cursor: cursor ?? flagString(input.cursor),
        },
      })
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) => fetchPage(cursor))
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderImages(rows),
      }
    }
    const page = await fetchPage(undefined)
    return { data: page, human: renderImages(page.data) }
  },
})

function renderImages(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No brand assets found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'assetId', header: 'ID' },
    { key: 'kind', header: 'KIND' },
    { key: 'url', header: 'URL' },
    { key: 'addedAt', header: 'ADDED' },
  ])
}
