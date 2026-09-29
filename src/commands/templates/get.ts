import type { TemplatesIncludeToken } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { asSdkInput, flagString } from '../../lib/input'

/**
 * One public gallery template. Organization-wide like `templates list`, so no
 * brand binding is sent (the SDK omits X-Brand-Id for templates).
 */
export const templatesGetCommand = defineCommand({
  path: ['templates', 'get'],
  summary:
    'Fetch one public template: its links and the referenceEmailId to remix; --include html adds its HTML',
  sdkMethod: 'templates.get',
  route: { method: 'GET', path: '/v1/templates/{templateId}' },
  commandClass: 'read',
  args: [
    {
      name: 'templateId',
      summary: 'Template id: the TEMPLATE column (emailId) of `templates list`',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--include <tokens>',
      summary:
        'Expansions: html (the rendered HTML; a large page arrives as a content.url download link instead)',
    },
  ],
  examples: [
    'brew-cli templates get seed-vercel-newsletter',
    'brew-cli templates get seed-vercel-newsletter --include html --json',
  ],
  run: async ({ ctx, args, flags }) => {
    const include = flagString(flags.include)
    // The token passes through unchecked: the API validates it and names
    // the ones it takes.
    const body = await ctx
      .client()
      .templates.get(
        args.templateId ?? '',
        include === undefined
          ? undefined
          : { include: asSdkInput<TemplatesIncludeToken>(include) }
      )
    return { data: body }
  },
})
