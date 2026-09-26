import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import { flagString } from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type EmailDetail =
  operations['getEmail']['responses'][200]['content']['application/json']

export const emailsGetCommand = defineCommand({
  path: ['emails', 'get'],
  summary: 'Fetch one email design by id — the bare row',
  sdkMethod: 'emails.get',
  route: { method: 'GET', path: '/v1/emails/{emailId}' },
  commandClass: 'read',
  args: [
    {
      name: 'emailId',
      summary: 'Design id returned by emails generate/import',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--include <tokens>',
      summary: 'Comma-separated expansions: html, versions, text, links',
    },
    {
      flag: '--email-version-id <emailVersionId>',
      summary:
        'Read this saved version instead of the current head (ids from --include versions)',
    },
    {
      flag: '--run-id <runId>',
      summary:
        'Read the version a generate or edit run produced (the runId it returned)',
    },
  ],
  examples: [
    'brew-cli emails get eml_2SmZOWV3ZQ7W5x6g3m4p',
    'brew-cli emails get eml_2SmZOWV3ZQ7W5x6g3m4p --include html,versions',
    'brew-cli emails get eml_2SmZOWV3ZQ7W5x6g3m4p --include text,links',
    'brew-cli emails get eml_2SmZOWV3ZQ7W5x6g3m4p --email-version-id emv_2SmZOWV3ZQ7W5x6g3m4p --include html',
  ],
  run: async ({ ctx, args, flags }) => {
    const emailId = args.emailId ?? ''
    const include = flagString(flags.include)
    const emailVersionId = flagString(flags.emailVersionId)
    const runId = flagString(flags.runId)
    if (emailVersionId !== undefined && runId !== undefined) {
      throw new CliUsageError(
        'Pass --email-version-id or --run-id, not both: each selects the version to read.'
      )
    }
    if (emailVersionId === undefined && runId === undefined) {
      return {
        data: await ctx
          .client()
          .emails.get(emailId, include === undefined ? undefined : { include }),
      }
    }
    // `@brew.new/sdk` 10's `emails.get` options carry no version selector
    // (SDK 11's do): a selected read goes through the raw transport until the
    // CLI adopts SDK 11.
    return {
      data: await rawRequest<EmailDetail>(ctx, {
        method: 'GET',
        path: `/v1/emails/${encodeURIComponent(emailId)}`,
        query: { include, emailVersionId, runId },
      }),
    }
  },
})
