import type { UpdateDomainSettingsInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'

export const domainsUpdateCommand = defineCommand({
  path: ['domains', 'update'],
  summary: 'Update default sender settings for a domain',
  sdkMethod: 'domains.updateSettings',
  route: { method: 'PATCH', path: '/v1/domains/{domainId}' },
  commandClass: 'write',
  args: [
    { name: 'domainId', summary: 'Domain id to update', isRequired: true },
  ],
  flags: [
    {
      flag: '--default-sender-name <name>',
      summary: 'Default From display name',
    },
    {
      flag: '--default-from-email <email>',
      summary: 'Default From address on this domain',
    },
    {
      flag: '--default-reply-to-email <email>',
      summary: 'Default Reply-To address',
    },
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli domains update dom_8s1Kj --default-sender-name "Brew Coffee"',
  ],
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      defaultSenderName: flagString(flags.defaultSenderName),
      defaultFromEmail: flagString(flags.defaultFromEmail),
      defaultReplyToEmail: flagString(flags.defaultReplyToEmail),
    })
    if (Object.keys(input).length === 0) {
      throw new CliUsageError('Nothing to update — pass flags or --input.')
    }
    const result = await ctx.client().domains.updateSettings(
      asSdkInput<UpdateDomainSettingsInput>({
        domainId: args.domainId ?? '',
        ...input,
      })
    )
    return { data: result }
  },
})
