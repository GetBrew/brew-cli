import { defineCommand } from '../../lib/define-command'
import { CliApiError } from '../../lib/errors'
import { flagString } from '../../lib/input'

export const automationsGetCommand = defineCommand({
  path: ['automations', 'get'],
  summary: 'Fetch one automation by id',
  sdkMethod: null,
  derivedFrom: 'automations.list',
  route: { method: 'GET', path: '/v1/automations' },
  commandClass: 'read',
  args: [
    {
      name: 'automationId',
      summary: 'Id of the automation',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--include <tokens>',
      summary: 'Comma-separated expansions: graph | versions',
    },
  ],
  examples: [
    'brew-cli automations get am_123',
    'brew-cli automations get am_123 --include graph,versions',
  ],
  run: async ({ ctx, args, flags }) => {
    const automationId = args.automationId ?? ''
    const include = flagString(flags.include)
    const result = await ctx.client().automations.list({
      automationId,
      ...(include === undefined ? {} : { include }),
    })
    const automation = result.data[0]
    if (automation === undefined) {
      throw new CliApiError({
        status: 404,
        code: 'AUTOMATION_NOT_FOUND',
        type: 'not_found',
        message: `No automation found for ${automationId}`,
        suggestion: 'List automations with `brew-cli automations list`.',
      })
    }
    return { data: automation }
  },
})
