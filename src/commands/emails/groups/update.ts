import type { components } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import {
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../../lib/input'
import { rawRequest } from '../../../lib/raw-request'

type EmailGroupSummary = components['schemas']['EmailGroupSummary']

export const emailsGroupsUpdateCommand = defineCommand({
  path: ['emails', 'groups', 'update'],
  summary: 'Rename an email folder (group)',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'PATCH', path: '/v1/email-groups/{groupId}' },
  commandClass: 'write',
  args: [
    {
      name: 'groupId',
      summary: 'Named group id (grp_*); Ungrouped cannot be renamed',
      isRequired: true,
    },
  ],
  flags: [
    { flag: '--name <name>', summary: 'New folder label, 1-60 chars' },
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli emails groups update grp_welcome --name "Welcome series"',
  ],
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, { name: flagString(flags.name) })
    if (typeof input.name !== 'string' || input.name === '') {
      throw new CliUsageError('--name is required (or provide it via --input).')
    }
    return {
      data: await rawRequest<EmailGroupSummary>(ctx, {
        method: 'PATCH',
        path: `/v1/email-groups/${encodeURIComponent(args.groupId ?? '')}`,
        body: input,
      }),
    }
  },
})
