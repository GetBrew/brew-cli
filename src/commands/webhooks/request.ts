import type { CommandInvocation, HttpMethod } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  mergeInput,
  readJsonFlag,
  requestOptions,
} from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

export const WEBHOOK_ENDPOINT_FLAGS = [
  { flag: '--endpoint <url>', summary: 'Public HTTPS endpoint URL' },
  { flag: '--description <text>', summary: 'Endpoint description' },
] as const

/** Prepare once so piped input also survives the confirmation protocol. */
export async function prepareWebhookInput({ ctx, flags }: CommandInvocation) {
  requestOptions(flags)
  const overrides = Object.fromEntries(
    ['endpoint', 'description', 'status', 'type'].flatMap((key) =>
      typeof flags[key] === 'string' ? [[key, flags[key]]] : []
    )
  )
  const input = mergeInput(
    await readJsonFlag(ctx, flags.input, '--input'),
    overrides
  )
  if (
    Object.keys(input).some(
      (key) => key === 'webhookId' || key === 'eventId' || key === 'brandId'
    )
  ) {
    throw new CliUsageError(
      'Resource identities belong in positional arguments; use --brand for brand selection.'
    )
  }
  return input
}

/** Shared raw transport while the matching SDK resource awaits publication. */
export function webhookRunner<Output, Input = never>(route: {
  readonly method: HttpMethod
  readonly path: string
}) {
  return async (invocation: CommandInvocation) => {
    const { ctx, args, flags } = invocation
    const path = route.path.replace(
      /\{(\w+)\}/g,
      (_match: string, key: string) => encodeURIComponent(args[key] ?? '')
    )
    const input = invocation.input ?? (await prepareWebhookInput(invocation))
    const isBody = route.method === 'POST' || route.method === 'PATCH'
    const data = await rawRequest<Output>(ctx, {
      method: route.method,
      path,
      ...(isBody ? { body: asSdkInput<Input>(input) } : {}),
      ...(route.method === 'GET'
        ? {
            query: {
              limit: flagString(flags.limit),
              cursor: flagString(flags.cursor),
            },
          }
        : {}),
      ...requestOptions(flags),
    })
    return { data }
  }
}
