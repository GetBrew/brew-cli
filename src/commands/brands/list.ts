import type { ListBrandsInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { asSdkInput, flagInt, flagString } from '../../lib/input'
import {
  ALL_FLAG,
  CURSOR_FLAG,
  collectAll,
  LIMIT_FLAG,
} from '../../lib/paginate'

export const brandsListCommand = defineCommand({
  path: ['brands', 'list'],
  summary: 'List every brand in the organization',
  sdkMethod: 'brands.list',
  route: { method: 'GET', path: '/v1/brands' },
  commandClass: 'read',
  flags: [
    {
      flag: '--status <status>',
      summary:
        'Only brands in one lifecycle state: extracting | completed | failed | deleting',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
  ],
  examples: [
    'brew-cli brands list --json',
    'brew-cli brands list --status completed',
    'brew-cli brands list --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const input = {
      status: flagString(flags.status),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    }
    const brands = ctx.client().brands
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        brands.list(
          asSdkInput<ListBrandsInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
      }
    }
    return { data: await brands.list(asSdkInput<ListBrandsInput>(input)) }
  },
})
