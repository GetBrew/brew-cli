import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import { flagString, IDEMPOTENCY_FLAG } from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type FigmaToEmailResponse = components['schemas']['FigmaToEmailResponse']

export const emailsImportFigmaCommand = defineCommand({
  path: ['emails', 'import-figma'],
  summary:
    'Convert one Figma frame into an editable design (deterministic, free)',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/emails/figma' },
  commandClass: 'write',
  flags: [
    {
      flag: '--url <figmaUrl>',
      summary: 'Figma frame link; must include a node-id query parameter',
    },
    {
      flag: '--title <title>',
      summary: 'Design title (default: the Figma frame name)',
    },
    {
      flag: '--format <format>',
      summary: 'Representation returned in content: jsx (default) or html',
    },
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli emails import-figma --url "https://www.figma.com/design/abc123/Launch?node-id=1-2"',
  ],
  run: async ({ ctx, flags }) => {
    const figmaUrl = flagString(flags.url)
    if (figmaUrl === undefined) {
      throw new CliUsageError(
        '--url is required (a Figma frame link containing node-id).'
      )
    }
    const title = flagString(flags.title)
    const format = flagString(flags.format)
    return {
      data: await rawRequest<FigmaToEmailResponse>(ctx, {
        method: 'POST',
        path: '/v1/emails/figma',
        body: {
          figmaUrl,
          ...(title === undefined ? {} : { title }),
          ...(format === undefined ? {} : { format }),
        },
        idempotencyKey: flagString(flags.idempotencyKey),
      }),
    }
  },
})
