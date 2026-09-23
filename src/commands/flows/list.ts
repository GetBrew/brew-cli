import type { Flow, ListFlowsInput } from '@brew.new/sdk'
import { includeRidesDetailRead, singleRowPage } from '../../lib/compat'
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

/**
 * Public email flows: one brand's real onboarding or newsletter sequence,
 * with the day each email landed, as LIST cards. One flow with every step is
 * `flows get <slug>`.
 *
 * The route is organization-wide, so the SDK never sends the brand binding.
 */
export const flowsListCommand = defineCommand({
  path: ['flows', 'list'],
  summary:
    'List public email flows (real multi-step sequences by brand) as cards; `flows get <slug>` reads one',
  sdkMethod: 'flows.list',
  route: { method: 'GET', path: '/v1/flows' },
  commandClass: 'read',
  flags: [
    {
      // --brand is taken by the global brand-selection flag.
      flag: '--brand-domain <domain>',
      summary: 'Filter the list by brand domain',
    },
    {
      flag: '--category <category>',
      summary: 'Filter by dominant step category (welcome, newsletter, …)',
    },
    {
      flag: '--type <type>',
      summary: 'Filter by how the sequence starts: signup | newsletter',
    },
    {
      flag: '--semantic <text>',
      summary: 'Semantic search over the sequences (relevance order)',
    },
    {
      flag: '--sort <order>',
      summary: 'List order: newest (default) | emails | span | remixes',
    },
    {
      flag: '--slug <domain>',
      summary:
        '0.6 shim: read ONE flow with its steps as a single-row page (`flows get <slug>` is the real read)',
    },
    {
      flag: '--include <keys>',
      summary: "With --slug only: `html` adds each step's rendered HTML",
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli flows list --type signup --sort emails',
    'brew-cli flows list --brand-domain brew.new --json',
    'brew-cli flows list --semantic "developer onboarding drip"',
  ],
  run: async ({ ctx, flags }) => {
    const flows = ctx.client().flows
    const slug = flagString(flags.slug)
    const include = flagString(flags.include)
    if (slug !== undefined) {
      const flow = await flows.get(
        slug,
        include === undefined ? undefined : { include }
      )
      return { data: singleRowPage(flow), human: renderFlows([flow]) }
    }
    if (include !== undefined) {
      throw includeRidesDetailRead('flows get', '--slug')
    }
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      brand: flagString(flags.brandDomain),
      category: flagString(flags.category),
      type: flagString(flags.type),
      semantic: flagString(flags.semantic),
      sort: flagString(flags.sort),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    if (flags.all === true) {
      const rows = await collectAll(ctx, (cursor) =>
        flows.list(
          asSdkInput<ListFlowsInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
      )
      return {
        data: { data: rows, pagination: { cursor: null, hasMore: false } },
        human: renderFlows(rows),
      }
    }
    const result = await flows.list(asSdkInput<ListFlowsInput>(input))
    return { data: result, human: renderFlows(result.data) }
  },
})

function renderFlows(rows: ReadonlyArray<Flow>): string {
  if (rows.length === 0) {
    return 'No flows found.'
  }
  return renderTable(
    rows.map((row) => ({
      slug: row.slug,
      brand: row.brand.name,
      type: row.type,
      category: row.category,
      emails: row.emailCount,
      spanDays: row.spanDays,
    })),
    [
      { key: 'slug', header: 'SLUG' },
      { key: 'brand', header: 'BRAND' },
      { key: 'type', header: 'TYPE' },
      { key: 'category', header: 'CATEGORY' },
      { key: 'emails', header: 'EMAILS' },
      { key: 'spanDays', header: 'SPAN (DAYS)' },
    ]
  )
}
