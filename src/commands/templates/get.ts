import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { flagString } from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type TemplateDetail =
  operations['getTemplate']['responses'][200]['content']['application/json']

/**
 * One public gallery template. Organization-wide like `templates list`, so no
 * brand binding is sent. Raw route because `@brew.new/sdk` 10 has no method
 * for it: once the CLI adopts SDK 11, bind `templates.get(templateId,
 * { include })` here and drop `isRawTransport`.
 */
export const templatesGetCommand = defineCommand({
  path: ['templates', 'get'],
  summary:
    'Fetch one public template: its links and the referenceEmailId to remix; --include html adds its HTML',
  sdkMethod: null,
  isRawTransport: true,
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
    const body = await rawRequest<TemplateDetail>(ctx, {
      method: 'GET',
      path: `/v1/templates/${encodeURIComponent(args.templateId ?? '')}`,
      query: { include: flagString(flags.include) },
    })
    return { data: body }
  },
})
