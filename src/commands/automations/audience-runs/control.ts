import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import {
  flagString,
  IDEMPOTENCY_FLAG,
  requestOptions,
} from '../../../lib/input'

/**
 * The 0.6 verb-flag form of `automations audience-runs pause|resume|cancel`.
 * `POST …/control { action }` left the API in the v1 cleanup, and command
 * names are additive-only after release (AGENTS.md), so this stays as CLI
 * sugar dispatching to the three action commands' SDK methods. No `route`:
 * the spec has none for it. No single `derivedFrom`: it backs onto three.
 */
export const automationsAudienceRunsControlCommand = defineCommand({
  path: ['automations', 'audience-runs', 'control'],
  summary:
    'Pause, resume, or cancel an in-flight manual-audience run (0.6 form of `audience-runs pause|resume|cancel`)',
  sdkMethod: null,
  commandClass: 'destructive',
  args: [
    {
      name: 'audienceRunId',
      summary: 'Audience run id to control',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--action <action>',
      summary: 'pause (resumable) | resume | cancel (final)',
    },
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli automations audience-runs control arun_01HZ --action pause',
    'brew-cli automations audience-runs control arun_01HZ --action cancel --yes',
  ],
  // Only cancel is irreversible; pause and resume proceed ungated.
  confirmSummary: ({ args, flags }) =>
    flagString(flags.action) === 'cancel'
      ? `Cancel audience run ${args.audienceRunId ?? ''} for good. Emails already sent are not recalled, and a canceled run cannot be resumed.`
      : undefined,
  run: async ({ ctx, args, flags }) => {
    const audienceRuns = ctx.client().automations.audienceRuns
    const audienceRunId = args.audienceRunId ?? ''
    const options = requestOptions(flags)
    switch (flagString(flags.action)) {
      case 'pause':
        return { data: await audienceRuns.pause(audienceRunId, options) }
      case 'resume':
        return { data: await audienceRuns.resume(audienceRunId, options) }
      case 'cancel':
        return { data: await audienceRuns.cancel(audienceRunId, options) }
      default:
        throw new CliUsageError(
          '--action is required: pause, resume, or cancel.'
        )
    }
  },
})
