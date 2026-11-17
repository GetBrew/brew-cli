import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type Input = components['schemas']['ProductAnalyticsIdentityTokenRequest']
type Response = components['schemas']['ProductAnalyticsIdentityTokenResponse']

export const analyticsIdentityTokenCommand = defineCommand({
  path: ['analytics', 'identity-token'],
  summary:
    'Issue a five-minute browser identity token for a verified application user and existing brand contact (contacts scope)',
  // Switch to analytics.createIdentityToken when that SDK method is released.
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/analytics/identity-token' },
  commandClass: 'write',
  flags: [
    {
      flag: '--project-id <id>',
      summary: 'Analytics project in the selected brand',
    },
    {
      flag: '--user-id <id>',
      summary:
        'Application user ID; verify its ownership before issuing this token',
    },
    {
      flag: '--anonymous-id <id>',
      summary: 'Browser anonymous ID to bind to that user',
    },
    {
      flag: '--contact-id <id>',
      summary:
        'Existing contact in the selected brand; never creates or subscribes a contact',
    },
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli analytics identity-token --project-id pap_project --user-id user-123 --anonymous-id anon-123 --contact-id 507f1f77bcf86cd799439011',
  ],
  run: async ({ ctx, flags }) => {
    const input = mergeInput(await readJsonFlag(ctx, flags.input, '--input'), {
      projectId: flagString(flags.projectId),
      userId: flagString(flags.userId),
      anonymousId: flagString(flags.anonymousId),
      contactId: flagString(flags.contactId),
    })
    for (const field of ['projectId', 'userId', 'anonymousId', 'contactId']) {
      if (typeof input[field] !== 'string' || !input[field]) {
        throw new CliUsageError(
          `${field} is required through its flag or --input.`
        )
      }
    }
    return {
      data: await rawRequest<Response>(ctx, {
        method: 'POST',
        path: '/v1/analytics/identity-token',
        body: asSdkInput<Input>(input),
        idempotency: 'none',
      }),
    }
  },
})
