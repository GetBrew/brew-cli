import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { rawRequest } from '../../lib/raw-request'

type TransactionalEmail = components['schemas']['TransactionalEmail']

export const transactionalGetCommand = defineCommand({
  path: ['transactional', 'get'],
  summary:
    'Read a transactional email object: locked design/domain/envelope; Liquid workspaces add `variableTree` + a fireable `examplePayload`',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/transactional/{transactionId}' },
  commandClass: 'read',
  args: [
    {
      name: 'transactionId',
      summary:
        'Transactional email id (txn_…) from Email Actions → Transactional Email',
      isRequired: true,
    },
  ],
  examples: ['brew-cli transactional get txn_8fK2mQ4pLx'],
  // `variables` (legacy merge tags) is always present. `templating.engine`,
  // `variableTree`, and `examplePayload` only appear on Liquid-enabled
  // workspaces: variableTree lists every trigger.*/customer.* path the
  // pinned template references, and examplePayload is a ready-to-send
  // `payload` body for `emails send` (or `POST /v1/sends { transactionId,
  // to, payload }`). Nested payload values are Liquid-only — the same
  // shape sent to a non-Liquid workspace is rejected with 400. A `--test`
  // send on `emails send` accepts the identical `payload` shape with the
  // same live-fire rendering parity, so an examplePayload preview matches
  // what a real fire produces.
  run: async ({ ctx, args }) => ({
    data: await rawRequest<TransactionalEmail>(ctx, {
      method: 'GET',
      path: `/v1/transactional/${encodeURIComponent(args.transactionId ?? '')}`,
    }),
  }),
})
