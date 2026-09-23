import type { ListAudiencesInput } from '@brew.new/sdk'
import { includeRidesDetailRead, inputField } from '../../lib/compat'
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

export const audiencesListCommand = defineCommand({
  path: ['audiences', 'list'],
  summary: 'List audience segments; one segment is `audiences get`',
  sdkMethod: 'audiences.list',
  route: { method: 'GET', path: '/v1/audiences' },
  commandClass: 'read',
  flags: [
    {
      flag: '--include <tokens>',
      summary:
        '0.6 flag: includes ride the detail read now (`audiences get --include count,build`)',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli audiences list',
    'brew-cli audiences list --limit 10',
    'brew-cli audiences list --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    if (
      (flagString(flags.include) ?? inputField(base, 'include')) !== undefined
    ) {
      throw includeRidesDetailRead('audiences get')
    }
    const input = mergeInput(base, {
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const audiences = ctx.client().audiences
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        audiences.list(
          asSdkInput<ListAudiencesInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderAudiences(rows),
      }
    }
    const result = await audiences.list(asSdkInput<ListAudiencesInput>(input))
    return { data: result, human: renderAudiences(result.data) }
  },
})

function renderAudiences(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No audiences found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'audienceId', header: 'AUDIENCE ID' },
    { key: 'audienceName', header: 'NAME' },
    { key: 'count', header: 'CONTACTS' },
    { key: 'updatedAt', header: 'UPDATED' },
  ])
}
