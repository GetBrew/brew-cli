import type { CountContactsInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import {
  asSdkInput,
  flagString,
  INPUT_FLAG,
  mergeInput,
  parseFilterFlags,
  readJsonFlag,
} from '../../lib/input'

export const contactsCountCommand = defineCommand({
  path: ['contacts', 'count'],
  summary: 'Count contacts matching a filter',
  sdkMethod: 'contacts.count',
  route: { method: 'POST', path: '/v1/contacts/search' },
  commandClass: 'read',
  flags: [
    { flag: '--search <text>', summary: 'Free-text search' },
    {
      flag: '--filter <filters...>',
      summary: 'Structured filter field:operator[:value], repeatable',
    },
    { flag: '--audience <audienceId>', summary: 'Scope to one audience' },
    { flag: '--logic <logic>', summary: 'Filter combinator: and | or' },
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli contacts count',
    'brew-cli contacts count --filter subscribed:equals:true',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      search: flagString(flags.search),
      filters: parseFilterFlags(flags.filter),
      audienceId: flagString(flags.audience),
      logic: flagString(flags.logic),
    })
    return {
      data: await ctx
        .client()
        .contacts.count(asSdkInput<CountContactsInput>(input)),
    }
  },
})
