import type { ListFieldsInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { asSdkInput, flagInt, flagString } from '../../lib/input'
import {
  ALL_FLAG,
  CURSOR_FLAG,
  collectAll,
  LIMIT_FLAG,
} from '../../lib/paginate'

export const fieldsListCommand = defineCommand({
  path: ['fields', 'list'],
  summary: 'List custom contact fields',
  sdkMethod: 'fields.list',
  route: { method: 'GET', path: '/v1/fields' },
  commandClass: 'read',
  flags: [
    {
      flag: '--include <tokens>',
      summary:
        'Expansions: coverage (per-field fill stats: percent of contacts with a value, and top values)',
    },
    {
      flag: '--audience-id <audienceId>',
      summary:
        'Scope --include coverage to one saved audience (ignored without it)',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
  ],
  examples: [
    'brew-cli fields list',
    'brew-cli fields list --include coverage',
    'brew-cli fields list --include coverage --audience-id aud_2SmZOWV3ZQ7W5x6g3m4p --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const input = {
      include: flagString(flags.include),
      audienceId: flagString(flags.audienceId),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    }
    const fields = ctx.client().fields
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        fields.list(
          asSdkInput<ListFieldsInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
      }
    }
    return { data: await fields.list(asSdkInput<ListFieldsInput>(input)) }
  },
})
