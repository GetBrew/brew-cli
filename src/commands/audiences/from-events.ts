import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  toStringArray,
} from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type AudiencesFromEventsResponse =
  components['schemas']['AudiencesFromEventsResponse']

export const audiencesFromEventsCommand = defineCommand({
  path: ['audiences', 'from-events'],
  summary:
    'Create a frozen audience snapshot from analytics events (async build)',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/audiences/from-events' },
  commandClass: 'write',
  flags: [
    { flag: '--name <name>', summary: 'Audience name' },
    {
      flag: '--event-types <types...>',
      summary:
        'Event type(s), repeatable: sent, delivered, delivery_delayed, opened, clicked, bounced, complained, failed, skipped, unsubscribed',
    },
    {
      flag: '--since <datetime>',
      summary: 'Cohort window start (ISO-8601, max 90 days back)',
    },
    {
      flag: '--until <datetime>',
      summary: 'Cohort window end (ISO-8601, default now)',
    },
    { flag: '--send-id <sendId>', summary: 'Scope to one campaign send' },
    { flag: '--email-id <emailId>', summary: 'Scope to one email design' },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli audiences from-events --name "Opened in July" --event-types opened --since 2026-07-01T00:00:00Z --until 2026-08-01T00:00:00Z',
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
    if (typeof cohort.from !== 'string' || cohort.from === '') {
      throw new CliUsageError(
        '--since is required (or provide cohort.from via --input).'
      )
    }
    return {
      data: await rawRequest<AudiencesFromEventsResponse>(ctx, {
        method: 'POST',
        path: '/v1/audiences/from-events',
        body: { ...input, cohort },
        idempotencyKey: flagString(flags.idempotencyKey),
      }),
    }
  },
})
