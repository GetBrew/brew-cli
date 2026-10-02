import type { Flow, ListFlowsInput } from '@brew.new/sdk'
import {
  includeRidesDetailRead,
  inputField,
  singleRowPage,
} from '../../lib/compat'
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
    'brew-cli flows list --type signup --limit 1 --json  # .total counts every match',
  ],
  run: async ({ ctx, flags }) => {
    const flows = ctx.client().flows
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const slug = flagString(flags.slug) ?? inputField(base, 'slug')
    const include = flagString(flags.include) ?? inputField(base, 'include')
    if (slug !== undefined) {
      const flow = await flows.get(
        slug,
        include === undefined ? undefined : { include }
      )
      return {
        data: singleRowPage(flow),
        human: renderFlows([flow], {}, { isSemantic: false }),
      }
    }
    if (include !== undefined) {
      throw includeRidesDetailRead('flows get', '--slug')
    }
    const input = mergeInput(base, {
      brand: flagString(flags.brandDomain),
      category: flagString(flags.category),
      type: flagString(flags.type),
      semantic: flagString(flags.semantic),
      sort: flagString(flags.sort),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const isSemantic = 'semantic' in input && input.semantic !== undefined
    if (flags.all === true) {
      let count: FlowCount = {}
      const rows = await collectAll(ctx, async (cursor) => {
        const page = await flows.list(
          asSdkInput<ListFlowsInput>({
            ...input,
            ...(cursor === undefined ? {} : { cursor }),
          })
        )
        count = readCount(page)
        return page
      })
      return {
        data: {
          data: rows,
          pagination: { cursor: null, hasMore: false },
          ...count,
        },
        human: renderFlows(rows, count, { isSemantic, isAllPages: true }),
      }
    }
    const result = await flows.list(asSdkInput<ListFlowsInput>(input))
    return {
      data: result,
      human: renderFlows(result.data, readCount(result), { isSemantic }),
    }
  },
})

/**
 * What `GET /v1/flows` says about every page: `total` counts the flows the
 * query matches (filters narrow it, `semantic` only orders it), and it is a
 * floor when `isTotalExact` is false. Optional, so the command still reads a
 * deployment that predates the count (brew-v2#1805) and prints no count line.
 */
type FlowCount = {
  readonly total?: number
  readonly isTotalExact?: boolean
}

/**
 * The count a page carries, read at runtime: the field is new in the API
 * (and SDK 11.4), so a page from an older deployment simply has none. Only
 * the fields present are returned, so `--all` can spread them onto its
 * merged envelope.
 */
function readCount(page: object): FlowCount {
  const total =
    'total' in page && typeof page.total === 'number' ? page.total : undefined
  const isTotalExact =
    'isTotalExact' in page && typeof page.isTotalExact === 'boolean'
      ? page.isTotalExact
      : undefined
  return {
    ...(total === undefined ? {} : { total }),
    ...(isTotalExact === undefined ? {} : { isTotalExact }),
  }
}

/**
 * Nothing found in a PARTIAL read is not "no flows match". A partial read has
 * one cause, the API's 500-flow cut, which the filters apply after (a search
 * that cannot run is the API's 503, surfaced as an error). The command knows
 * which 500 were read, so it names them; no retry of the query gets past it.
 */
function partialEmptyMessage({ isSemantic }: { isSemantic: boolean }): string {
  return isSemantic
    ? 'No flows found among the 500 flows nearest your --semantic query, so that is not a definitive none: matches past those are not listed.'
    : 'No flows found among the newest 500 flows the API reads, so that is not a definitive none: older matches are not listed.'
}

/**
 * "167 flows in total; 25 on this page", or "at least …" for a floor. `--all`
 * merges every page from its cursor on, so its rows are what it LISTED, never
 * one page.
 */
function countLine(
  count: FlowCount,
  shown: number,
  { isAllPages }: { isAllPages: boolean }
): string | undefined {
  if (count.total === undefined) {
    return undefined
  }
  const floor = count.isTotalExact === false ? 'at least ' : ''
  const noun = count.total === 1 ? 'flow' : 'flows'
  const total = `${floor}${count.total} ${noun} in total`
  if (count.total === shown) {
    return total
  }
  return `${total}; ${shown} ${isAllPages ? 'listed' : 'on this page'}`
}

function renderFlows(
  rows: ReadonlyArray<Flow>,
  count: FlowCount,
  {
    isSemantic,
    isAllPages = false,
  }: { isSemantic: boolean; isAllPages?: boolean }
): string {
  if (rows.length === 0) {
    return count.isTotalExact === false
      ? partialEmptyMessage({ isSemantic })
      : 'No flows found.'
  }
  const line = countLine(count, rows.length, { isAllPages })
  const table = renderTable(
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
  return line === undefined ? table : `${line}\n\n${table}`
}
