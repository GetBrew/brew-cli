import type { PreviewEmailClientsInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import {
  asSdkInput,
  IDEMPOTENCY_FLAG,
  requestOptions,
  toStringArray,
} from '../../lib/input'
import { progress } from '../../lib/output'

export const emailsPreviewClientsCommand = defineCommand({
  path: ['emails', 'preview-clients'],
  summary:
    'Start a rendering job across real email clients (10 credits); poll it with `emails get-client-preview`',
  sdkMethod: 'emails.previewClients',
  route: { method: 'POST', path: '/v1/emails/{emailId}/client-previews' },
  commandClass: 'write',
  isCredited: true,
  args: [
    { name: 'emailId', summary: 'Design id to preview', isRequired: true },
  ],
  flags: [
    {
      flag: '--clients <ids...>',
      summary:
        'Client id(s) to render, repeatable (e.g. applemail16 iphone16_18); default: a popular spread',
    },
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli emails preview-clients eml_2SmZOWV3ZQ7W5x6g3m4p',
    'brew-cli emails preview-clients eml_2SmZOWV3ZQ7W5x6g3m4p --clients applemail16 outlook2021_win11_lm_dt',
    'PREVIEW_ID=$(brew-cli emails preview-clients eml_2SmZOWV3ZQ7W5x6g3m4p --json | jq -r .previewId) && brew-cli emails get-client-preview "$PREVIEW_ID"',
  ],
  // The API answers 202 with the admitted job (or 200 with the existing job
  // for the same version and clients): `previewId`, its `status` and
  // per-client progress. Screenshots arrive on the job once it settles, so
  // `emails get-client-preview <previewId>` is how they are read.
  run: async ({ ctx, args, flags }) => {
    const clients = toStringArray(flags.clients)
    const job = await ctx.client().emails.previewClients(
      asSdkInput<PreviewEmailClientsInput>({
        emailId: args.emailId ?? '',
        ...(clients === undefined ? {} : { clients }),
      }),
      requestOptions(flags)
    )
    const hint = pollHint(job)
    if (hint !== undefined) {
      progress(ctx, hint)
    }
    return { data: job }
  },
})

/**
 * `@brew.new/sdk` 10 still types this response as the old blocking batch
 * (no `previewId`, `ready | partial`), so the job fields are read
 * defensively until the CLI adopts SDK 11.
 */
function pollHint(job: unknown): string | undefined {
  if (
    typeof job !== 'object' ||
    job === null ||
    !('previewId' in job) ||
    !('status' in job)
  ) {
    return
  }
  const { previewId, status } = job
  if (
    typeof previewId !== 'string' ||
    (status !== 'queued' && status !== 'running')
  ) {
    return
  }
  return `Rendering job ${previewId} is ${status}. Poll it with: brew-cli emails get-client-preview ${previewId}`
}
