import type { Flow, ListFlowsInput } from '@brew.new/sdk'
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
 * Public email flows: one brand's real onboarding or newsletter sequence,
 * with the day each email landed. Two modes on one route, as the API has
 * them — LIST cards, or `--slug` for ONE flow with every step.
 *
 * The route is organization-wide, so the SDK never sends the brand binding.
 */
export const flowsListCommand = defineCommand({
  path: ['flows', 'list'],
  summary:
    'List public email flows (real multi-step sequences by brand), or fetch one by --slug with every step',
  sdkMethod: 'flows.list',
  route: { method: 'GET', path: '/v1/flows' },
  commandClass: 'read',
  flags: [
    {
      flag: '--slug <domain>',
      summary:
        'Fetch ONE flow by brand domain (e.g. brew.new) with its anchor + steps',
    },
    {
      flag: '--include <keys>',
      summary:
        'Detail-only expansions, comma-separated: html (each step’s rendered HTML)',
    },
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
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli flows list --type signup --sort emails',
    'brew-cli flows list --slug brew.new --include html --json',
    'brew-cli flows list --semantic "developer onboarding drip"',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      slug: flagString(flags.slug),
      include: flagString(flags.include),
      brand: flagString(flags.brandDomain),
      category: flagString(flags.category),
      type: flagString(flags.type),
      semantic: flagString(flags.semantic),
      sort: flagString(flags.sort),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const flows = ctx.client().flows
    if (flags.all === true) {
      if (input.slug !== undefined) {
        throw new CliUsageError(
          '--all pages the LIST; it cannot be combined with --slug.'
        )
      }
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
  const [only] = rows
  if (rows.length === 1 && only?.steps !== undefined) {
    return renderSteps(only)
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

function renderSteps(flow: Flow): string {
  const header = `${flow.title} — ${flow.brand.name} (${flow.slug}), ${flow.emailCount} emails over ${flow.spanDays} days${flow.anchor === undefined ? '' : `, day 0 = ${flow.anchor}`}`
  const table = renderTable(
    (flow.steps ?? []).map((step) => ({
      order: step.order,
      day: step.dayOffset,
      wait: step.delayDays,
      subject: step.subject,
      category: step.category,
      emailId: step.emailId,
    })),
    [
      { key: 'order', header: '#' },
      { key: 'day', header: 'DAY' },
      { key: 'wait', header: 'WAIT' },
      { key: 'subject', header: 'SUBJECT' },
      { key: 'category', header: 'CATEGORY' },
      { key: 'emailId', header: 'TEMPLATE' },
    ]
  )
  return `${header}\n\n${table}`
}
