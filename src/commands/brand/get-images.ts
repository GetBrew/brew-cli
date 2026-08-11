import type { ListBrandImagesInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
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

export const brandGetImagesCommand = defineCommand({
  path: ['brand', 'get-images'],
  summary: "Browse or semantically search the brand's image library",
  sdkMethod: 'brand.getImages',
  route: { method: 'GET', path: '/v1/brand/images' },
  commandClass: 'read',
  flags: [
    {
      flag: '--query <text>',
      summary: 'Semantic search over image descriptions',
    },
    { flag: '--type <type>', summary: 'Filter by image category' },
    {
      flag: '--aspect-ratio <ratio>',
      summary: 'Filter by aspect ratio (e.g. 16:9)',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli brand get-images',
    'brew-cli brand get-images --query "team photo" --aspect-ratio 16:9',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      q: flagString(flags.query),
      type: flagString(flags.type),
      aspectRatio: flagString(flags.aspectRatio),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const brand = ctx.client().brand
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        brand.getImages(
          asSdkInput<ListBrandImagesInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderImages(rows),
      }
    }
    const result = await brand.getImages(
      asSdkInput<ListBrandImagesInput>(input)
    )
    return { data: result, human: renderImages(result.data) }
  },
})

function renderImages(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No brand images found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'url', header: 'URL' },
    { key: 'category', header: 'CATEGORY' },
    { key: 'aspectRatio', header: 'ASPECT' },
  ])
}
