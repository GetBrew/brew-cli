import { defineCommand } from '../../../lib/define-command'
import {
  flagInt,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../../lib/input'
import { ALL_FLAG, CURSOR_FLAG, LIMIT_FLAG } from '../../../lib/paginate'
import { listSends, SEND_STATUS_SUMMARY } from '../../sends/list'

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
