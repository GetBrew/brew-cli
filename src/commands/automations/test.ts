import type { AutomationsResource } from '@brew.new/sdk'
import { enforceStdinConfirmation } from '../../lib/confirm'
import { defineCommand } from '../../lib/define-command'
import {
  asSdkInput,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  readJsonFlag,
  requestOptions,
} from '../../lib/input'

type TestAutomationInput = Parameters<AutomationsResource['test']>[0]

export const automationsTestCommand = defineCommand({
  path: ['automations', 'test'],
  summary:
    'Test an automation; testRecipient delivers real mail, omit for a dry run',
  sdkMethod: 'automations.test',
  route: { method: 'POST', path: '/v1/automations/{automationId}/test' },
  commandClass: 'destructive',
  args: [
    {
      name: 'automationId',
      summary: 'Id of the automation to test',
      isRequired: true,
    },
  ],
  flags: [INPUT_FLAG, IDEMPOTENCY_FLAG],
  examples: [
    'brew-cli automations test am_123',
    `brew-cli automations test am_123 --input '{"userId":"u_1"}'`,
    `brew-cli automations test am_123 --input '{"testRecipient":"qa@example.com"}' --yes`,
  ],
  confirmSummary: ({ args, flags }) => {
    if (typeof flags.input !== 'string' || flags.input === '-') {
      return
    }
    // Stdin is checked after it is read; malformed inline JSON gets the
    // normal usage error in run rather than a confirmation prompt.
    let base: unknown
    try {
      base = JSON.parse(flags.input)
    } catch {
      return
    }
    const { testRecipient } = automationTestBody(base)
    if (typeof testRecipient !== 'string' || testRecipient.trim() === '') {
      return
    }
    return `Test automation ${args.automationId ?? ''}: each send node delivers REAL mail to ${testRecipient.trim()}. Real test deliveries count toward send usage.`
  },
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const body = automationTestBody(base)
    await enforceStdinConfirmation(
      automationsTestCommand,
      { ctx, args, flags },
      body
    )
    const result = await ctx.client().automations.test(
      asSdkInput<TestAutomationInput>({
        ...body,
        automationId: args.automationId ?? '',
      }),
      requestOptions(flags)
    )
    return { data: result }
  },
})

/** Preserve API controls; a bare trigger payload remains shorthand. */
function automationTestBody(base: unknown): Record<string, unknown> {
  if (base === undefined) {
    return {}
  }
  if (
    isRecord(base) &&
    ['payload', 'testRecipient', 'scenario'].some((key) =>
      Object.hasOwn(base, key)
    )
  ) {
    return base
  }
  return { payload: base }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
