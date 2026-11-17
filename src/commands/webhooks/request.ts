import type { CommandInvocation } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import { mergeInput, readJsonFlag, requestOptions } from '../../lib/input'

export const WEBHOOK_ENDPOINT_FLAGS = [
  { flag: '--endpoint <url>', summary: 'Public HTTPS endpoint URL' },
  {
    flag: '--events <types>',
    summary: 'Comma-separated event types, e.g. email.delivered,email.bounced',
  },
  { flag: '--description <text>', summary: 'Endpoint description' },
] as const

/** Prepare once so piped input also survives the confirmation protocol. */
export async function prepareWebhookInput({ ctx, flags }: CommandInvocation) {
  requestOptions(flags)
  const base = await readJsonFlag(ctx, flags.input, '--input')
  if (Array.isArray(base)) {
    throw new CliUsageError('--input must be a JSON object')
  }
  const overrides: Record<string, unknown> = Object.fromEntries(
    ['endpoint', 'description', 'status', 'type'].flatMap((key) =>
      typeof flags[key] === 'string' ? [[key, flags[key]]] : []
    )
  )
  if (typeof flags.events === 'string') {
    overrides.events = flags.events
      .split(',')
      .map((type) => type.trim())
      .filter(Boolean)
  }
  const input = mergeInput(base, overrides)
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
