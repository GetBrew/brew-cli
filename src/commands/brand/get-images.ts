import type { ListBrandImagesInput } from '@brew.new/sdk'
import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
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

type BrandImagesPage = components['schemas']['BrandImagesResponse']
type BrandAsset = BrandImagesPage['data'][number]

/**
 * Filters brew-v2#1713 retired (`type` became `kind`; `aspectRatio` went).
 * The SDK does not send them, so they are refused here, naming the way
 * forward, rather than silently dropped.
 */
const RETIRED_FILTERS: Readonly<Record<string, string>> = {
  type: '--type (type) was retired by the API: use --kind logo|brand|generated.',
  aspectRatio:
    '--aspect-ratio (aspectRatio) was retired by the API: every image carries its width and height.',
}

export const brandGetImagesCommand = defineCommand({
  path: ['brand', 'get-images'],
  summary:
    "Browse or semantically search the brand's assets (logos, brand images, images made with Brew)",
  sdkMethod: 'brand.getImages',
  route: { method: 'GET', path: '/v1/brand/images' },
  commandClass: 'read',
  flags: [
    {
      flag: '--query <text>',
      summary:
        'Semantic search over what the images show (1 credit per new search; logos are not searchable)',
    },
    {
      flag: '--kind <kind>',
      summary: 'logo, brand (from the site or uploaded) or generated',
    },
    {
      flag: '--sort <order>',
      summary: 'Browse order: newest (default) or oldest; ignored by --query',
    },
    {
      flag: '--type <type>',
      summary: 'Retired by the API: use --kind',
    },
    {
      flag: '--aspect-ratio <ratio>',
      summary:
        'Retired by the API: rows carry width and height instead of a shape filter',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli brand get-images',
    'brew-cli brand get-images --kind generated --sort oldest --all',
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
      type: flagString(flags.type),
      aspectRatio: flagString(flags.aspectRatio),
    })
    // A retired filter from a flag or from --input fails here, naming the
    // way forward, instead of as a 400 from the API.
    for (const [key, message] of Object.entries(RETIRED_FILTERS)) {
      if (input[key] !== undefined) {
        throw new CliUsageError(message)
      }
    }
    // --kind and --sort pass through unchecked: the API validates them.
    const page = (cursor: string | undefined) =>
      ctx
        .client()
        .brand.getImages(
          asSdkInput<ListBrandImagesInput>(
            cursor === undefined ? input : { ...input, cursor }
          )
        )
    if (flags.all === true) {
      const rows = await collectAll(ctx, page)
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderAssets(rows),
      }
    }
    const result = await page(undefined)
    return { data: result, human: renderAssets(result.data) }
  },
})

function renderAssets(rows: ReadonlyArray<BrandAsset>): string {
  if (rows.length === 0) {
    return 'No brand assets found.'
  }
  return renderTable(
    rows.map((row) => ({
      assetId: row.assetId,
      kind: row.kind,
      url: row.url,
      size:
        row.width !== undefined && row.height !== undefined
          ? `${row.width}x${row.height}`
          : '',
      added: row.addedAt ?? '',
    })),
    [
      { key: 'assetId', header: 'ASSET ID' },
      { key: 'kind', header: 'KIND' },
      { key: 'url', header: 'URL' },
      { key: 'size', header: 'SIZE' },
      { key: 'added', header: 'ADDED' },
    ]
  )
}
