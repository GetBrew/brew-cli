import type { PreviewEmailClientsInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import {
  asSdkInput,
  IDEMPOTENCY_FLAG,
  requestOptions,
  toStringArray,
} from '../../lib/input'

export const emailsPreviewClientsCommand = defineCommand({
  path: ['emails', 'preview-clients'],
  summary: 'Render the design across real email clients (10 credits)',
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
  ],
  run: async ({ ctx, args, flags }) => {
    const clients = toStringArray(flags.clients)
    return {
      data: await ctx.client().emails.previewClients(
        asSdkInput<PreviewEmailClientsInput>({
          emailId: args.emailId ?? '',
          ...(clients === undefined ? {} : { clients }),
        }),
        requestOptions(flags)
      ),
    }
  },
})
