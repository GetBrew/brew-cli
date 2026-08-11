import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import {
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type AutomationRunResponse =
  | components['schemas']['AudienceAutomationRunStartedResponse']
  | components['schemas']['AutomationRunDryRunResponse']

export const automationsRunCommand = defineCommand({
  path: ['automations', 'run'],
  summary: 'Run a manual-audience automation (live send; --dry-run previews)',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/automations/{automationId}/run' },
  commandClass: 'destructive',
  args: [
    {
      name: 'automationId',
      summary: 'Manual-audience automation id to run',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--dry-run',
      summary: 'Preview the resolved plan without sending (skips the gate)',
    },
    {
      flag: '--schedule-at <iso>',
      summary: 'Launch at an ISO-8601 time instead of now',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli automations run auto_abc --dry-run',
    'brew-cli automations run auto_abc --yes',
    'brew-cli automations run auto_abc --schedule-at 2026-09-01T09:00:00Z --input \'{"gradualSend":{"startingPercentage":10,"incrementPercentage":20,"interval":{"value":1,"unit":"day"},"timeZone":"America/New_York"}}\' --yes',
  ],
  confirmSummary: ({ args, flags }) => {
    // The gate must reflect the MERGED request — an inline --input body can
    // carry dry_run/scheduledAt on its own. A dry run never gates.
    const inline = parseInlineInput(flags.input)
    if (flags.dryRun === true || inline?.dry_run === true) {
      return
    }
    const scheduleAt =
      flagString(flags.scheduleAt) ?? asString(inline?.scheduledAt)
    const timing = scheduleAt === undefined ? 'now' : `at ${scheduleAt}`
    return `Run automation ${args.automationId ?? ''} LIVE against its bound audience ${timing}. Real recipients receive mail; preview with --dry-run instead.`
  },
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      // The spec field is snake_case, unlike the rest of the API surface.
      dry_run: flags.dryRun === true ? true : undefined,
      scheduledAt: flagString(flags.scheduleAt),
    })
    return {
      data: await rawRequest<AutomationRunResponse>(ctx, {
        method: 'POST',
        path: `/v1/automations/${encodeURIComponent(args.automationId ?? '')}/run`,
        body: input,
        idempotencyKey: flagString(flags.idempotencyKey),
      }),
    }
  },
})

/** Best-effort parse of an inline --input body (stdin `-` stays opaque). */
function parseInlineInput(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'string' || value === '-') {
    return
  }
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed !== null && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : undefined
  } catch {}
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}
