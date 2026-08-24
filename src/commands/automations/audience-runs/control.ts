import type { ControlAudienceRunInput } from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import { asSdkInput, flagString } from '../../../lib/input'

export const automationsAudienceRunsControlCommand = defineCommand({
  path: ['automations', 'audience-runs', 'control'],
  summary: 'Pause, resume, or cancel an in-flight manual-audience run',
  sdkMethod: 'automations.audienceRuns.control',
  route: {
    method: 'POST',
    path: '/v1/automations/audience-runs/{audienceRunId}/control',
  },
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
    const action = flagString(flags.action)
    if (action === undefined) {
      throw new CliUsageError('--action is required: pause, resume, or cancel.')
    }
    return {
      data: await ctx.client().automations.audienceRuns.control(
        asSdkInput<ControlAudienceRunInput>({
          audienceRunId: args.audienceRunId ?? '',
          action,
        })
      ),
    }
  },
})
