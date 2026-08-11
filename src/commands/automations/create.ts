import type { CreateAutomationInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  requestOptions,
} from '../../lib/input'

export const automationsCreateCommand = defineCommand({
  path: ['automations', 'create'],
  summary: 'Create an automation from a graph JSON (starts unpublished)',
  sdkMethod: 'automations.create',
  route: { method: 'POST', path: '/v1/automations' },
  commandClass: 'write',
  flags: [
    { flag: '--name <name>', summary: 'Automation name' },
    { flag: '--description <text>', summary: 'Automation description' },
    {
      flag: '--trigger <triggerEventId>',
      summary: 'Trigger event id that starts the automation',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'cat welcome-flow.json | brew-cli automations create --input -',
    `brew-cli automations create --name "Welcome flow" --input '{"triggerEventId":"tev_1","nodes":[],"connections":[]}'`,
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    if (base === undefined) {
      throw new CliUsageError(
        '--input is required — the automation graph JSON (name, triggerEventId, nodes, connections).'
      )
    }
    const input = mergeInput(base, {
      name: flagString(flags.name),
      description: flagString(flags.description),
      triggerEventId: flagString(flags.trigger),
    })
    const result = await ctx
      .client()
      .automations.create(
        asSdkInput<CreateAutomationInput>(input),
        requestOptions(flags)
      )
    return { data: result }
  },
})
