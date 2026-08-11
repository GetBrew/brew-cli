import type { ListTemplatesInput } from '@brew.new/sdk'
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

export const templatesListCommand = defineCommand({
  path: ['templates', 'list'],
  summary: 'List public templates (each row carries the rendered html)',
  sdkMethod: 'templates.list',
  route: { method: 'GET', path: '/v1/templates' },
  commandClass: 'read',
  flags: [
    {
      // --brand is taken by the global brand-selection flag.
      flag: '--brand-name <name>',
      summary: 'Filter by gallery brand name',
    },
    { flag: '--category <category>', summary: 'Filter by category' },
    {
      flag: '--semantic <text>',
      summary: 'Semantic search over the gallery',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli templates list --category welcome',
    'brew-cli templates list --semantic "minimal product launch" --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      brand: flagString(flags.brandName),
      category: flagString(flags.category),
      semantic: flagString(flags.semantic),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const templates = ctx.client().templates
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        templates.list(
          asSdkInput<ListTemplatesInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderTemplates(rows),
      }
    }
    const result = await templates.list(asSdkInput<ListTemplatesInput>(input))
    return { data: result, human: renderTemplates(result.data) }
  },
})

function renderTemplates(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No templates found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'emailId', header: 'TEMPLATE' },
    { key: 'title', header: 'TITLE' },
    { key: 'category', header: 'CATEGORY' },
    { key: 'brand', header: 'BRAND' },
  ])
}
