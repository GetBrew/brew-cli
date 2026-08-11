import type { AddDomainInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  requestOptions,
} from '../../lib/input'

export const domainsAddCommand = defineCommand({
  path: ['domains', 'add'],
  summary: 'Add a sending domain (response lists the DNS records to set)',
  sdkMethod: 'domains.add',
  route: { method: 'POST', path: '/v1/domains' },
  commandClass: 'write',
  args: [
    {
      name: 'domain',
      summary: 'Domain name to add (e.g. mail.example.com)',
      isRequired: true,
    },
  ],
  flags: [
    { flag: '--region <region>', summary: 'Sending region (us-east-1)' },
    {
      flag: '--custom-return-path <subdomain>',
      summary: 'Custom Return-Path subdomain',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: ['brew-cli domains add mail.example.com'],
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      name: args.domain,
      region: flagString(flags.region),
      customReturnPath: flagString(flags.customReturnPath),
    })
    const result = await ctx
      .client()
      .domains.add(asSdkInput<AddDomainInput>(input), requestOptions(flags))
    return { data: result }
  },
})
