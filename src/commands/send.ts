import type { BrewDefaultSendPayload, BrewSendResponse } from '@brew.new/sdk'
import { defineCommand } from '../lib/define-command'
import { CliUsageError } from '../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  readJsonFlag,
  requestOptions,
} from '../lib/input'
import { triggerKeyArg } from '../lib/trigger-key'

export const sendCommand = defineCommand({
  path: ['send'],
  summary:
    'Send the app email behind a trigger key (fires the key: starts LIVE runs)',
  sdkMethod: 'send',
  route: {
    method: 'POST',
    path: '/v1/automations/triggers/by-key/{triggerKey}/fire',
  },
  commandClass: 'destructive',
  args: [
    {
      name: 'key',
      summary: 'Trigger key, e.g. auth.password-reset or order.paid',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--to <email>',
      summary: 'Recipient address (sets payload.email; overrides --data)',
    },
    {
      flag: '--data <json>',
      summary:
        'Payload JSON object (the values the email reads as {{ trigger.* }}), or - to read stdin',
    },
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli send lifecycle.welcome --to jane@example.com --yes',
    `brew-cli send auth.password-reset --to jane@example.com --data '{"userName":"Jane","confirmationUrl":"https://app.example.com/reset?token=…"}' --yes`,
    `echo '{"email":"jane@example.com","orderId":"ord_1"}' | brew-cli send order.paid --data - --idempotency-key order.paid:ord_1 --yes`,
  ],
  confirmSummary: ({ args, flags }) => {
    const to = flagString(flags.to)
    return `Send ${args.key ?? ''}${to === undefined ? '' : ` to ${to}`}: starts REAL runs on every published automation listening to this key (the email goes out).`
  },
  run: async ({ ctx, args, flags }) => {
    const key = triggerKeyArg(args.key, 'The key')
    const data = await readJsonFlag(ctx, flags.data, '--data')
    if (
      data !== undefined &&
      (data === null || typeof data !== 'object' || Array.isArray(data))
    ) {
      throw new CliUsageError(
        '--data must be a JSON object (the payload, without a { payload } envelope).'
      )
    }
    const payload: Record<string, unknown> = {
      ...((data as Record<string, unknown> | undefined) ?? {}),
    }
    const to = flagString(flags.to)
    if (to !== undefined) {
      payload.email = to
    }
    if (typeof payload.email !== 'string' || payload.email.trim() === '') {
      throw new CliUsageError(
        'A recipient is required: --to <email>, or an "email" field in --data.'
      )
    }
    const result = await ctx
      .client()
      .send(
        key,
        asSdkInput<BrewDefaultSendPayload>(payload),
        requestOptions(flags)
      )
    return { data: result, human: renderSend(result) }
  },
})

function renderSend(result: BrewSendResponse): string {
  const runs = result.automationRunIds?.length ?? 0
  const lines = [
    `${result.status === 'replayed' ? 'Replayed' : 'Sent'} ${result.triggerKey}: ${runs} run${runs === 1 ? '' : 's'} started (instance ${result.triggerInstanceId}).`,
  ]
  for (const skipped of result.notStarted ?? []) {
    lines.push(
      `not started: ${skipped.automationId} (${skipped.code ?? skipped.reason})`
    )
  }
  for (const warning of result.warnings ?? []) {
    lines.push(`warning: ${warning.message ?? warning.code ?? ''}`)
  }
  return lines.join('\n')
}
