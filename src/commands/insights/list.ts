import type { ListInsightsInput, ListInsightsResponse } from '@brew.new/sdk'
import type { BrewClient } from '../../lib/client'
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

type InsightsResource = BrewClient['insights']
type InsightsPage = ListInsightsResponse

/**
 * What a page says beside its rows: the engine's `freshness` on every page,
 * and each expansion `--include` asked for (`null` until it exists).
 */
type PageExtras = Partial<Omit<InsightsPage, 'data' | 'pagination'>>

const EXTRA_KEYS = [
  'freshness',
  'pulse',
  'report',
  'suggestions',
  'memo',
] as const

/**
 * Brew Insights: the deterministic findings the insight engine keeps about
 * the brand's email (at most 200 in view), most severe first, as the
 * Insights page ranks them. `--include` adds the intelligence layer the page
 * shows beside them. One finding in full is `insights get`.
 */
export const insightsListCommand = defineCommand({
  path: ['insights', 'list'],
  summary:
    "List Brew Insights findings, most severe first, with the engine's freshness; `insights get` reads one",
  sdkMethod: 'insights.list',
  route: { method: 'GET', path: '/v1/insights' },
  commandClass: 'read',
  flags: [
    {
      flag: '--state <state>',
      summary:
        'open (default: active findings and ended snoozes) | all (adds resolved, cleared, dismissed, stale and snoozed ones)',
    },
    {
      flag: '--severity <severity>',
      summary:
        'Only this severity, up to 200 of its own: critical | warning | opportunity | info',
    },
    {
      flag: '--include <tokens>',
      summary:
        "Comma-separated expansions: pulse (the last 7 days against the 7 before), report (the latest intelligence report), suggestions (its open suggestions, up to 25), memo (the analysis agent's memo)",
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli insights list',
    'brew-cli insights list --severity critical --json',
    'brew-cli insights list --state all --all --json',
    'brew-cli insights list --include pulse,report,suggestions,memo',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      state: flagString(flags.state),
      severity: flagString(flags.severity),
      include: flagString(flags.include),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const insights = ctx.client().insights
    if (flags.all === true) {
      return await listEveryInsight(ctx, insights, input)
    }
    const page = await insights.list(asSdkInput<ListInsightsInput>(input))
    return { data: page, human: renderInsights(page.data, readExtras(page)) }
  },
})

/**
 * `--all`: every finding as one page. The expansions are page-level and the
 * same on every page, so only the first page asks for them; the merged
 * envelope carries that page's `freshness` and expansions beside the rows.
 */
async function listEveryInsight(
  ctx: CliContext,
  insights: InsightsResource,
  input: Readonly<Record<string, unknown>>
): Promise<{ data: unknown; human: string }> {
  const { include: _include, ...rest } = input
  let extras: PageExtras | undefined
  const rows = await collectAll(ctx, async (cursor) => {
    const page = await insights.list(
      asSdkInput<ListInsightsInput>(
        extras === undefined
          ? { ...input, ...(cursor === undefined ? {} : { cursor }) }
          : { ...rest, ...(cursor === undefined ? {} : { cursor }) }
      )
    )
    extras ??= readExtras(page)
    return page
  })
  const kept = extras ?? {}
  return {
    data: {
      data: rows,
      pagination: { cursor: null, hasMore: false },
      ...kept,
    },
    human: renderInsights(rows, kept),
  }
}

/** The page-level keys a page carries, verbatim. */
function readExtras(page: InsightsPage): PageExtras {
  const extras: Record<string, unknown> = {}
  for (const key of EXTRA_KEYS) {
    if (key in page) {
      extras[key] = page[key as keyof InsightsPage]
    }
  }
  return extras as PageExtras
}

type InsightRow = InsightsPage['data'][number]
type Freshness = InsightsPage['freshness']
type Pulse = NonNullable<InsightsPage['pulse']>
type Report = NonNullable<InsightsPage['report']>
type Suggestion = NonNullable<InsightsPage['suggestions']>[number]
type Memo = NonNullable<InsightsPage['memo']>

export function renderInsights(
  rows: ReadonlyArray<InsightRow>,
  extras: PageExtras
): string {
  const sections: string[] = []
  const freshness = freshnessLine(extras.freshness)
  if (freshness !== undefined) {
    sections.push(freshness)
  }
  sections.push(
    rows.length === 0
      ? 'No insights found.'
      : renderTable(
          rows.map((row) => ({ ...row })),
          [
            { key: 'severity', header: 'SEVERITY' },
            { key: 'title', header: 'TITLE' },
            { key: 'state', header: 'STATE' },
            { key: 'category', header: 'CATEGORY' },
            { key: 'insightId', header: 'INSIGHT' },
          ]
        )
  )
  if ('pulse' in extras) {
    sections.push(renderPulse(extras.pulse ?? null))
  }
  if ('report' in extras) {
    sections.push(renderReport(extras.report ?? null))
  }
  if ('suggestions' in extras) {
    sections.push(renderSuggestions(extras.suggestions ?? []))
  }
  if ('memo' in extras) {
    sections.push(renderMemo(extras.memo ?? null))
  }
  return sections.join('\n\n')
}

/**
 * How current the findings are. A failed latest run means they may be
 * stale; no `dataAsOf` means the engine has not finished a run yet.
 */
function freshnessLine(freshness: Freshness | undefined): string | undefined {
  if (freshness === undefined) {
    return undefined
  }
  const asOf =
    freshness.dataAsOf === null
      ? 'No insight run has finished yet'
      : `Data as of ${freshness.dataAsOf}`
  const attempt = freshness.latestAttempt
  if (attempt === null) {
    return `${asOf}.`
  }
  const stale =
    attempt.status === 'failed' ? '; these findings may be stale' : ''
  return `${asOf}; latest run ${attempt.status} at ${attempt.at}${stale}.`
}

function renderPulse(pulse: Pulse | null): string {
  if (pulse === null) {
    return 'Pulse: none yet.'
  }
  const pair = (label: string, now: number, prior: number): string =>
    `${label} ${now} (prior ${prior})`
  const rate = (
    label: string,
    now: number | null,
    prior: number | null,
    direction: string
  ): string | undefined =>
    now === null
      ? undefined
      : `${label} ${now}% (prior ${prior === null ? '-' : `${prior}%`}, ${direction})`
  const parts = [
    pair('delivered', pulse.delivered, pulse.priorDelivered),
    pair('unique opens', pulse.uniqueOpens, pulse.priorUniqueOpens),
    pair('unique clicks', pulse.uniqueClicks, pulse.priorUniqueClicks),
    pair('unsubscribed', pulse.unsubscribed, pulse.priorUnsubscribed),
    rate(
      'open rate',
      pulse.openRatePct,
      pulse.priorOpenRatePct,
      pulse.openDirection
    ),
    rate(
      'click rate',
      pulse.clickRatePct,
      pulse.priorClickRatePct,
      pulse.clickDirection
    ),
  ].filter((part): part is string => part !== undefined)
  return `Pulse, 7 days to ${pulse.windowEnd}:\n  ${parts.join('\n  ')}`
}

function renderReport(report: Report | null): string {
  if (report === null) {
    return 'Report: none yet.'
  }
  const head = `Report ${report.reportId} (${report.runTrigger}, ${report.createdAt}; chat ${report.chatId})`
  if (report.insights.length === 0) {
    return `${head}: no insights.`
  }
  const lines = report.insights.map(
    (insight) => `  [${insight.kind}] ${insight.title}`
  )
  return `${head}:\n${lines.join('\n')}`
}

function renderSuggestions(suggestions: ReadonlyArray<Suggestion>): string {
  if (suggestions.length === 0) {
    return 'Suggestions: none.'
  }
  return `Suggestions:\n${renderTable(
    suggestions.map((suggestion) => ({ ...suggestion })),
    [
      { key: 'suggestionId', header: 'SUGGESTION' },
      { key: 'status', header: 'STATUS' },
      { key: 'kind', header: 'KIND' },
      { key: 'title', header: 'TITLE' },
    ]
  )}`
}

function renderMemo(memo: Memo | null): string {
  if (memo === null) {
    return 'Memo: none yet.'
  }
  return `Memo v${memo.version} (updated ${memo.updatedAt}):\n${memo.markdown}`
}
