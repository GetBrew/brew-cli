import type { ListSendsInput } from '@brew.new/sdk'
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
import type { CliContext } from '../../lib/types'

/** The one status vocabulary every send, run and build reports. */
export const SEND_STATUS_SUMMARY =
  'scheduled | queued | running | paused | completed | partially_completed | failed | canceled'

export const sendsListCommand = defineCommand({
  path: ['sends', 'list'],
  summary:
    'List sends (the unit of delivery and analytics) with lifetime stats',
  sdkMethod: 'sends.list',
  route: { method: 'GET', path: '/v1/sends' },
  commandClass: 'read',
  flags: [
    { flag: '--email <emailId>', summary: 'Only sends of this design' },
    { flag: '--kind <kind>', summary: 'campaign | automation' },
    { flag: '--automation <automationId>', summary: 'Filter by automation' },
    {
      flag: '--automation-run <automationRunId>',
      summary: 'Deliveries of one automation run',
    },
    {
      flag: '--audience-run <audienceRunId>',
      summary: 'Deliveries of one manual-audience run',
    },
    {
      flag: '--trigger-instance <triggerInstanceId>',
      summary: 'Deliveries started by one fired trigger instance',
    },
    { flag: '--status <status>', summary: SEND_STATUS_SUMMARY },
    {
      flag: '--message-class <class>',
      summary: 'marketing | transactional',
    },
    {
      flag: '--since <datetime>',
      summary: 'Inclusive lower bound on updatedAt (ISO-8601)',
    },
    {
      flag: '--until <datetime>',
      summary: 'Inclusive upper bound on updatedAt (ISO-8601)',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli sends list --status completed',
    'brew-cli sends list --email eml_1 --all --json',
    'brew-cli sends list --automation-run arun_9f2kX',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      emailId: flagString(flags.email),
      kind: flagString(flags.kind),
      automationId: flagString(flags.automation),
      automationRunId: flagString(flags.automationRun),
      audienceRunId: flagString(flags.audienceRun),
      triggerInstanceId: flagString(flags.triggerInstance),
      status: flagString(flags.status),
      messageClass: flagString(flags.messageClass),
      from: flagString(flags.since),
      to: flagString(flags.until),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    return await listSends(ctx, input, flags.all === true)
  },
})

/**
 * The shared read behind `sends list` and the `analytics sends list` /
 * `analytics campaigns` aliases, so every name renders the same rows.
 */
export async function listSends(
  ctx: CliContext,
  input: Record<string, unknown>,
  followCursor: boolean
): Promise<{ data: unknown; human: string }> {
  const sends = ctx.client().sends
  if (followCursor) {
    const rows = await collectAll(ctx, (cursor) =>
      sends.list(
        asSdkInput<ListSendsInput>({
          ...input,
          ...(cursor === undefined ? {} : { cursor }),
        })
      )
    )
    return {
      data: { data: rows, pagination: { cursor: null, hasMore: false } },
      human: renderSends(rows),
    }
  }
  const result = await sends.list(asSdkInput<ListSendsInput>(input))
  return { data: result, human: renderSends(result.data) }
}

export function renderSends(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No sends found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'sendId', header: 'SEND' },
    { key: 'kind', header: 'KIND' },
    { key: 'status', header: 'STATUS' },
    { key: 'subject', header: 'SUBJECT' },
  ])
}
