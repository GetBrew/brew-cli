import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import { flagInt, IDEMPOTENCY_FLAG, requestOptions } from '../../lib/input'

export const emailsRestoreCommand = defineCommand({
  path: ['emails', 'restore'],
  summary: 'Restore a previous version as the new latest (non-destructive)',
  sdkMethod: 'emails.restore',
  route: { method: 'POST', path: '/v1/emails/{emailId}/restore' },
  commandClass: 'write',
  args: [
    { name: 'emailId', summary: 'Design id to restore', isRequired: true },
  ],
  // --version is taken by the CLI itself, hence --to-version.
  flags: [
    { flag: '--to-version <n>', summary: 'Version number to restore' },
    IDEMPOTENCY_FLAG,
  ],
  examples: ['brew-cli emails restore eml_2SmZOWV3ZQ7W5x6g3m4p --to-version 2'],
  run: async ({ ctx, args, flags }) => {
    const version = flagInt(flags.toVersion, '--to-version')
    if (version === undefined) {
      throw new CliUsageError(
        '--to-version is required (see `brew-cli emails get <emailId> --include versions`).'
      )
    }
    const result = await ctx
      .client()
      .emails.restore(
        { emailId: args.emailId ?? '', version },
        requestOptions(flags)
      )
    return { data: result }
  },
})
