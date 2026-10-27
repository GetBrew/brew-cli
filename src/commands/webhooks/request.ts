import type { CommandInvocation, HttpMethod } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import { flagString, mergeInput, readJsonFlag } from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

/** Shared raw transport while the matching SDK resource awaits publication. */
export function webhookRunner<Output>(route: {
  readonly method: HttpMethod
  readonly path: string
}) {
  return async ({ ctx, args, flags }: CommandInvocation) => {
    const path = route.path.replace(
      /\{(\w+)\}/g,
      (_match: string, key: string) => encodeURIComponent(args[key] ?? '')
    )
    const input = mergeInput(
      await readJsonFlag(ctx, flags.input, '--input'),
      {}
    )
    const isBody = route.method === 'POST' || route.method === 'PATCH'
    if (
      isBody &&
      Object.keys(input).some(
        (key) => key === 'webhookId' || key === 'eventId' || key === 'brandId'
      )
    )
      throw new CliUsageError(
        'Resource identities belong in positional arguments; use --brand for brand selection.'
      )
    const data = await rawRequest<Output>(ctx, {
      method: route.method,
      path,
      ...(isBody ? { body: input } : {}),
      ...(route.method === 'GET'
        ? {
            query: {
              limit: flagString(flags.limit),
              cursor: flagString(flags.cursor),
            },
          }
        : {}),
      idempotencyKey: flagString(flags.idempotencyKey),
    })
    return { data }
  }
}
