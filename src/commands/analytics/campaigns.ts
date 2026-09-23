import { defineCommand } from '../../lib/define-command'
import {
  flagInt,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'
import { ALL_FLAG, CURSOR_FLAG, LIMIT_FLAG } from '../../lib/paginate'
import { listSends } from '../sends/list'

/**
 * The name agents already know. There is no campaign analytics report any
 * more: a campaign IS a send of `kind: "campaign"`, and each row carries
 * its own lifetime `stats`.
 */
export const analyticsCampaignsCommand = defineCommand({
  path: ['analytics', 'campaigns'],
  summary:
    'Lifetime per-campaign KPIs (`sends list --kind campaign`; stats ride each row)',
  sdkMethod: null,
  derivedFrom: 'sends.list',
  route: { method: 'GET', path: '/v1/sends' },
  commandClass: 'read',
  flags: [LIMIT_FLAG, CURSOR_FLAG, ALL_FLAG, INPUT_FLAG],
  examples: [
    'brew-cli analytics campaigns',
    'brew-cli analytics campaigns --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      kind: 'campaign',
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    return await listSends(ctx, input, flags.all === true)
  },
})
