import type { operations } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import {
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  toStringArray,
} from '../../../lib/input'
import { rawRequest } from '../../../lib/raw-request'

type AddDomainUnsubscribesResponse =
  operations['addDomainUnsubscribes']['responses'][200]['content']['application/json']

/**
 * Raw route because `@brew.new/sdk` 10 has no method for it: once the CLI
 * adopts the SDK release that ships it, bind that method here and drop
 * `isRawTransport`.
 */
export const domainsUnsubscribesAddCommand = defineCommand({
  path: ['domains', 'unsubscribes', 'add'],
  summary:
    "Add up to 1,000 addresses to a marketing domain's unsubscribe list (this domain only; idempotent)",
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/domains/{domainId}/unsubscribes' },
  commandClass: 'write',
  args: [
    {
      name: 'domainId',
      summary: 'Marketing domain id (from `domains list`)',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--emails <emails...>',
      summary: 'Address(es) to suppress on this domain, repeatable',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli domains unsubscribes add kx7bkh53hasmfeh5kd7sqgykt187g8ww --emails jane@example.com sam@example.com',
    `brew-cli domains unsubscribes add kx7bkh53hasmfeh5kd7sqgykt187g8ww --input '["jane@example.com"]'`,
  ],
  // An existing contact is suppressed for this domain only; an address with
  // no contact is created already unsubscribed brand-wide
  // (`summary.created`). Malformed addresses come back under `invalid`.
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const body = mergeInput(Array.isArray(base) ? { emails: base } : base, {
      emails: toStringArray(flags.emails),
    })
    if (!Array.isArray(body.emails)) {
      throw new CliUsageError(
        'Pass --emails, or --input with a JSON array of addresses (or {"emails": [...]}).'
      )
    }
    const result = await rawRequest<AddDomainUnsubscribesResponse>(ctx, {
      method: 'POST',
      path: `/v1/domains/${encodeURIComponent(args.domainId ?? '')}/unsubscribes`,
      body,
      idempotencyKey: flagString(flags.idempotencyKey),
    })
    return { data: result }
  },
})
