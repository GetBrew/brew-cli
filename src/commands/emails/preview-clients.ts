import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { flagString, IDEMPOTENCY_FLAG, toStringArray } from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type EmailClientPreviewResponse =
  components['schemas']['EmailClientPreviewResponse']

export const emailsPreviewClientsCommand = defineCommand({
  path: ['emails', 'preview-clients'],
  summary: 'Render the design across real email clients (10 credits)',
  sdkMethod: null,
  isRawTransport: true,
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
      data: await rawRequest<EmailClientPreviewResponse>(ctx, {
        method: 'POST',
        path: `/v1/emails/${encodeURIComponent(args.emailId ?? '')}/client-previews`,
        // The body is required; an empty object requests the default spread.
        body: clients === undefined ? {} : { clients },
        idempotencyKey: flagString(flags.idempotencyKey),
      }),
    }
  },
})
