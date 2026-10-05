import type { ListTemplatesInput } from '@brew.new/sdk'
import type { operations } from '../../generated/openapi-types'
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

/**
 * The API's count mode (`count: true`, optionally `groupBy`; brew-v2#1821):
 * `{ count, groups? }` instead of rows. The SDK does not type it yet.
 */
type TemplateRowsInput = Omit<
  NonNullable<operations['listTemplates']['parameters']['query']>,
  'count' | 'groupBy'
>

type TemplatesCount = Extract<
  operations['listTemplates']['responses'][200]['content']['application/json'],
  { count: number }
>

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
    {
      flag: '--count',
      summary: 'Return matching template counts instead of rows',
    },
    {
      flag: '--group-by <field>',
      summary: 'Group counts by brand or category (requires --count)',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli templates list --category welcome',
    'brew-cli templates list --count --group-by category --json',
    'brew-cli templates list --semantic "minimal product launch" --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      brand: flagString(flags.brandName),
      category: flagString(flags.category),
      semantic: flagString(flags.semantic),
      count: flags.count === true ? true : undefined,
      groupBy: flagString(flags.groupBy),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const templates = ctx.client().templates
    const isCount =
      input.count === true ||
      input.count === 'true' ||
      input.groupBy !== undefined
    if (flags.all === true && isCount) {
      throw new CliUsageError(
        '--all pages through rows; a count has none. Page its groups with --cursor.'
      )
    }
    if (flags.all === true) {
      // `representation` may arrive through --input, so the SDK's return
      // type is the full-or-summary union; rows pass through verbatim.
      const rows = await collectAll<unknown>(ctx, (cursor) =>
        templates.list(
          asSdkInput<TemplateRowsInput>({
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
    const result: unknown = await templates.list(
      asSdkInput<ListTemplatesInput>(input)
    )
    // A count answers `{ count, groups? }`, not rows: the table would throw.
    const page = result as { data?: unknown }
    return {
      data: result,
      human: Array.isArray(page.data)
        ? renderTemplates(page.data)
        : renderCount(result as TemplatesCount),
    }
  },
})

function renderCount(body: TemplatesCount): string {
  const total = `${body.count} template${body.count === 1 ? '' : 's'}`
  const groups = body.groups ?? []
  if (body.groupBy === undefined && groups.length === 0) {
    return total
  }
  const noun = body.groupBy === 'category' ? 'categories' : 'brands'
  const table = renderTable(
    groups.map((group) => ({ ...group })),
    [
      {
        key: 'value',
        header: body.groupBy === 'category' ? 'CATEGORY' : 'BRAND',
      },
      ...(groups.some((group) => group.name !== undefined)
        ? [{ key: 'name', header: 'NAME' }]
        : []),
      { key: 'count', header: 'COUNT' },
    ]
  )
  const cursor = body.pagination?.hasMore ? body.pagination.cursor : null
  const footer = [
    `${total} in total`,
    body.groupCount === undefined ? '' : `${body.groupCount} ${noun}`,
    body.ungroupedCount
      ? `${body.ungroupedCount} with no ${noun === 'brands' ? 'brand' : 'category'}`
      : '',
    cursor === null ? '' : `more groups: --cursor ${cursor}`,
  ]
    .filter(Boolean)
    .join(' · ')
  return groups.length === 0 ? footer : `${table}\n${footer}`
}

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
