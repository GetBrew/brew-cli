import { defineCommand } from '../../lib/define-command'
import { flagString } from '../../lib/input'

export const brandGetCommand = defineCommand({
  path: ['brand', 'get'],
  summary: "Fetch the key's brand + extraction readiness (`ready` flag)",
  sdkMethod: 'brand.get',
  route: { method: 'GET', path: '/v1/brand' },
  commandClass: 'read',
  flags: [
    {
      flag: '--include <tokens>',
      summary:
        'Comma-separated embeds: identity | emailDesign | imageStyle | logos',
    },
  ],
  examples: [
    'brew-cli brand get',
    'brew-cli brand get --include identity,logos',
  ],
  run: async ({ ctx, flags }) => {
    const include = flagString(flags.include)
    const result = await ctx.client().brand.get({
      ...(include === undefined ? {} : { include }),
    })
    return { data: result }
  },
})
