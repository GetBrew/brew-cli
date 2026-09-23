import { defineCommand } from '../../../lib/define-command'
import { flagString } from '../../../lib/input'

export const automationsTriggersGetCommand = defineCommand({
  path: ['automations', 'triggers', 'get'],
  summary: 'Fetch one trigger by id — the bare row with its payload schema',
  sdkMethod: 'automations.triggers.get',
  route: { method: 'GET', path: '/v1/automations/triggers/{triggerEventId}' },
  commandClass: 'read',
  args: [
    {
      name: 'triggerEventId',
      summary: 'Trigger id (tri_…, or an integration composite id)',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--include <tokens>',
      summary: 'Expansions: skill (a SKILL.md-shaped wiring brief)',
    },
  ],
  examples: [
    'brew-cli automations triggers get tri_signup',
    'brew-cli automations triggers get tri_signup --include skill',
  ],
  run: async ({ ctx, args, flags }) => {
    const include = flagString(flags.include)
    return {
      data: await ctx
        .client()
        .automations.triggers.get(
          args.triggerEventId ?? '',
          include === undefined ? undefined : { include }
        ),
    }
  },
})
