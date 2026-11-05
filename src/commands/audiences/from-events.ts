import type { AudienceFromEventsInput } from '@brew.new/sdk'
import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  requestOptions,
  toStringArray,
} from '../../lib/input'

type CohortEventType =
  components['schemas']['AudiencesFromEventsRequest']['cohort']['eventTypes'][number]

/**
 * The cohort's event types, in the vendored spec's order. `satisfies` makes
 * `tsc` refuse a type the spec lacks and miss none it declares, so a spec sync
 * that changes the enum fails until this help text follows it.
 */
const COHORT_EVENT_TYPES = Object.keys({
  sent: true,
  delivered: true,
  delivery_delayed: true,
  opened: true,
  clicked: true,
  bounced: true,
  complained: true,
  failed: true,
  skipped: true,
  unsubscribed: true,
} satisfies Record<CohortEventType, true>)

export const audiencesFromEventsCommand = defineCommand({
  path: ['audiences', 'from-events'],
  summary:
    'Create a frozen audience snapshot from analytics events (async build)',
  sdkMethod: 'audiences.fromEvents',
  route: { method: 'POST', path: '/v1/audiences/from-events' },
  commandClass: 'write',
  flags: [
    { flag: '--name <name>', summary: 'Audience name' },
    {
      flag: '--event-types <types...>',
      summary: `Event type(s), repeatable: ${COHORT_EVENT_TYPES.join(', ')}`,
    },
    {
      flag: '--since <datetime>',
      summary:
        'Cohort window start (ISO-8601, max 90 days back; optional with --send-id)',
    },
    {
      flag: '--until <datetime>',
      summary: 'Cohort window end (ISO-8601, default now)',
    },
    {
      flag: '--send-id <sendId>',
      summary:
        'Scope to one campaign send; derives the window when --since is omitted',
    },
    { flag: '--email-id <emailId>', summary: 'Scope to one email design' },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli audiences from-events --name "Opened in July" --event-types opened --since 2026-07-01T00:00:00Z --until 2026-08-01T00:00:00Z',
    'brew-cli audiences from-events --name "Send openers" --event-types opened --send-id snd_123',
    'brew-cli audiences from-events --event-types opened clicked --since 2026-07-01T00:00:00Z --input \'{"cohort":{"recipient":["@acme.com"]}}\'',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, { name: flagString(flags.name) })
    // Scalar flags override the cohort inside an --input body key-by-key.
    const cohort = mergeInput(input.cohort, {
      eventTypes: toStringArray(flags.eventTypes),
      from: flagString(flags.since),
      to: flagString(flags.until),
      sendId: flagString(flags.sendId),
      emailId: flagString(flags.emailId),
    })
    if (!Array.isArray(cohort.eventTypes) || cohort.eventTypes.length === 0) {
      throw new CliUsageError(
        '--event-types is required (or provide cohort.eventTypes via --input).'
      )
    }
    if (
      (typeof cohort.from !== 'string' || cohort.from === '') &&
      (typeof cohort.sendId !== 'string' || cohort.sendId.trim() === '')
    ) {
      throw new CliUsageError(
        '--since or --send-id is required (or provide cohort.from or cohort.sendId via --input).'
      )
    }
    return {
      data: await ctx
        .client()
        .audiences.fromEvents(
          asSdkInput<AudienceFromEventsInput>({ ...input, cohort }),
          requestOptions(flags)
        ),
    }
  },
})
