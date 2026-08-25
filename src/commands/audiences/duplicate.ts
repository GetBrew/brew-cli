import type { DuplicateAudienceInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { asSdkInput, IDEMPOTENCY_FLAG, requestOptions } from '../../lib/input'

export const audiencesDuplicateCommand = defineCommand({
  path: ['audiences', 'duplicate'],
  summary: 'Copy an audience segment (the copy gets a "(copy)" name)',
  sdkMethod: 'audiences.duplicate',
  route: { method: 'POST', path: '/v1/audiences/{audienceId}/duplicate' },
  commandClass: 'write',
  args: [
    {
      name: 'audienceId',
      summary: 'Audience id to duplicate',
      isRequired: true,
    },
  ],
  // The operation takes no request body — the API names the copy itself.
  flags: [IDEMPOTENCY_FLAG],
  examples: ['brew-cli audiences duplicate aud_3k9sQ'],
  run: async ({ ctx, args, flags }) => ({
    data: await ctx.client().audiences.duplicate(
      asSdkInput<DuplicateAudienceInput>({
        audienceId: args.audienceId ?? '',
      }),
      requestOptions(flags)
    ),
  }),
})
