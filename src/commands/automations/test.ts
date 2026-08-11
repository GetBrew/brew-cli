import type { AutomationsResource } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { asSdkInput, INPUT_FLAG, readJsonFlag } from '../../lib/input'

type TestAutomationInput = Parameters<AutomationsResource['test']>[0]

export const automationsTestCommand = defineCommand({
  path: ['automations', 'test'],
  summary: 'Start a suppression-aware TEST run (no real mail is sent)',
  sdkMethod: 'automations.test',
  route: { method: 'POST', path: '/v1/automations/{automationId}/test' },
  commandClass: 'write',
  args: [
    {
      name: 'automationId',
      summary: 'Id of the automation to test',
      isRequired: true,
    },
  ],
  flags: [INPUT_FLAG],
  examples: [
    'brew-cli automations test am_123',
    `brew-cli automations test am_123 --input '{"userId":"u_1"}'`,
  ],
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    // A bare object is sugar for the { payload } envelope the API takes.
    const body =
      base === undefined
        ? {}
        : typeof base === 'object' && base !== null && 'payload' in base
          ? (base as Record<string, unknown>)
          : { payload: base }
    const result = await ctx.client().automations.test(
      asSdkInput<TestAutomationInput>({
        ...body,
        automationId: args.automationId ?? '',
      })
    )
    return { data: result }
  },
})
