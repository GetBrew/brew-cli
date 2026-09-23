import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import { flagString, IDEMPOTENCY_FLAG, requestOptions } from '../../lib/input'

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
    {
      flag: '--to-version <emailVersionId>',
      summary:
        'Version id to restore (from `emails get <emailId> --include versions`)',
    },
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli emails restore eml_2SmZOWV3ZQ7W5x6g3m4p --to-version emv_7Hq2',
  ],
  run: async ({ ctx, args, flags }) => {
    const emailVersionId = flagString(flags.toVersion)
    if (emailVersionId === undefined) {
      throw new CliUsageError(
        '--to-version is required (a version id; see `brew-cli emails get <emailId> --include versions`).'
      )
    }
    const result = await ctx
      .client()
      .emails.restore(
        { emailId: args.emailId ?? '', emailVersionId },
        requestOptions(flags)
      )
    return { data: result }
  },
})
