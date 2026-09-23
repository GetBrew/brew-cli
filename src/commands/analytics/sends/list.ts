import { includeRidesDetailRead, singleRowPage } from '../../../lib/compat'
import { defineCommand } from '../../../lib/define-command'
import {
  flagInt,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../../lib/input'
import { ALL_FLAG, CURSOR_FLAG, LIMIT_FLAG } from '../../../lib/paginate'
import { listSends, renderSends, SEND_STATUS_SUMMARY } from '../../sends/list'

/**
 * The name agents already know, now reading the sends root. Analytics keeps
 * only reports (`overview`, `events`, `automations`); a send and its
 * lifetime `stats` live on the send row itself.
 */
export const analyticsSendsListCommand = defineCommand({
  path: ['analytics', 'sends', 'list'],
  summary: 'List campaign/automation sends with delivery stats (`sends list`)',
  sdkMethod: null,
  derivedFrom: 'sends.list',
  route: { method: 'GET', path: '/v1/sends' },
  commandClass: 'read',
  flags: [
    {
      flag: '--send <sendId>',
      summary:
        '0.6 shim: read ONE send as a single-row page (`sends get` is the real read)',
    },
    {
      flag: '--include <tokens>',
      summary: 'With --send only: detail includes (`events`)',
    },
    { flag: '--email <emailId>', summary: 'Filter by email design' },
    { flag: '--kind <kind>', summary: 'campaign | automation' },
    { flag: '--status <status>', summary: SEND_STATUS_SUMMARY },
    { flag: '--since <datetime>', summary: 'Window start (ISO-8601)' },
    { flag: '--until <datetime>', summary: 'Window end (ISO-8601)' },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli analytics sends list --status completed',
    'brew-cli analytics sends list --email eml_1 --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const sendId = flagString(flags.send)
    const include = flagString(flags.include)
    if (sendId !== undefined) {
      const row = await ctx
        .client()
        .sends.get(sendId, include === undefined ? undefined : { include })
      return { data: singleRowPage(row), human: renderSends([row]) }
    }
    if (include !== undefined) {
      throw includeRidesDetailRead('sends get', '--send')
    }
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      emailId: flagString(flags.email),
      kind: flagString(flags.kind),
      status: flagString(flags.status),
      from: flagString(flags.since),
      to: flagString(flags.until),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    return await listSends(ctx, input, flags.all === true)
  },
})
