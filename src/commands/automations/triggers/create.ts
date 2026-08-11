import type { CreateTriggerInput } from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  requestOptions,
} from '../../../lib/input'

export const automationsTriggersCreateCommand = defineCommand({
  path: ['automations', 'triggers', 'create'],
  summary: 'Create a trigger event (title + typed payload schema)',
  sdkMethod: 'automations.triggers.create',
  route: { method: 'POST', path: '/v1/automations/triggers' },
  commandClass: 'write',
  flags: [
    { flag: '--title <title>', summary: 'Trigger event title' },
    { flag: '--description <text>', summary: 'Trigger event description' },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    `brew-cli automations triggers create --title user.signup --input '{"payloadSchema":{"type":"object","fields":[{"key":"userId","type":"string","required":true}]}}'`,
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      title: flagString(flags.title),
      description: flagString(flags.description),
    })
    if (typeof input.title !== 'string' || input.title === '') {
      throw new CliUsageError('A title is required (--title or --input).')
    }
    if (input.payloadSchema === undefined) {
      throw new CliUsageError(
        '--input with a payloadSchema is required (the typed contract fires are validated against).'
      )
    }
    const result = await ctx
      .client()
      .automations.triggers.create(
        asSdkInput<CreateTriggerInput>(input),
        requestOptions(flags)
      )
    return { data: result }
  },
})
