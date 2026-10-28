import type {
  ListIntegrationEventsInput,
  ListIntegrationEventsResponse,
} from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import {
  asSdkInput,
  flagInt,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../../lib/input'
import { renderTable } from '../../../lib/output'
import {
  ALL_FLAG,
  CURSOR_FLAG,
  collectAll,
  LIMIT_FLAG,
} from '../../../lib/paginate'

/**
 * The events the brand's connected live sources send (a PostHog project's
 * own events; the Stripe and Shopify app catalogs), source by source. Events
 * a member hid and internal traffic Brew suppressed are left out, so a page
 * can be short, even empty, before the last one: `--all` follows the cursor
 * to the end. Every page lists the same `sources`, so `--all` keeps the
 * first page's.
 */
export const integrationsEventsListCommand = defineCommand({
  path: ['integrations', 'events', 'list'],
  summary:
    "List the live events the brand's connected sources send (PostHog, Stripe, Shopify), busiest first; `integrations events get` reads one",
  sdkMethod: 'integrations.events.list',
  route: { method: 'GET', path: '/v1/integrations/events' },
  commandClass: 'read',
  flags: [
    {
      flag: '--provider <provider>',
      summary: "Only this provider's events, e.g. posthog",
    },
    {
      flag: '--query <text>',
      summary:
        'Search event names, titles and categories (without it, the busiest events come first)',
    },
    {
      flag: '--kind <kind>',
      summary:
        'standard | custom | action (a saved provider action) | derived (computed from another event) | observed (seen in deliveries only)',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli integrations events list',
    'brew-cli integrations events list --provider posthog --query signup --json',
    'brew-cli integrations events list --kind custom --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      provider: flagString(flags.provider),
      query: flagString(flags.query),
      kind: flagString(flags.kind),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    const events = ctx.client().integrations.events
    if (flags.all === true) {
      let sources: ListIntegrationEventsResponse['sources'] | undefined
      const rows = await collectAll(
        ctx,
        async (cursor) => {
          const page = await events.list(
            asSdkInput<ListIntegrationEventsInput>({
              ...input,
              ...(cursor === undefined ? {} : { cursor }),
            })
          )
          sources ??= page.sources
          return page
        },
        { cursor: flagString(input.cursor) }
      )
      return {
        data: {
          data: rows,
          sources: sources ?? [],
          pagination: { cursor: null, hasMore: false },
        },
        human: renderEvents(rows),
      }
    }
    const page = await events.list(
      asSdkInput<ListIntegrationEventsInput>(input)
    )
    return { data: page, human: renderEvents(page.data) }
  },
})

function renderEvents(rows: ReadonlyArray<unknown>): string {
  if (rows.length === 0) {
    return 'No integration events found.'
  }
  return renderTable(rows as ReadonlyArray<Record<string, unknown>>, [
    { key: 'eventId', header: 'EVENT ID' },
    { key: 'provider', header: 'PROVIDER' },
    { key: 'eventKey', header: 'EVENT' },
    { key: 'label', header: 'LABEL' },
    { key: 'kind', header: 'KIND' },
    { key: 'volume30d', header: '30D' },
    { key: 'triggerEventId', header: 'TRIGGER' },
  ])
}
