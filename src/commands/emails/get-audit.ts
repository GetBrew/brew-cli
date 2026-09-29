import { defineCommand } from '../../lib/define-command'
import { flagInt, flagString } from '../../lib/input'
import { CURSOR_FLAG } from '../../lib/paginate'

/** A saved audit, read back by the `auditId` that `emails audit` returned. */
export const emailsGetAuditCommand = defineCommand({
  path: ['emails', 'get-audit'],
  summary:
    'Read a saved email audit: one page of its findings (free; never reruns the audit)',
  sdkMethod: 'emails.getAudit',
  route: { method: 'GET', path: '/v1/emails/audits/{auditId}' },
  commandClass: 'read',
  args: [
    {
      name: 'auditId',
      summary: 'The auditId `emails audit` returned (reports are kept 7 days)',
      isRequired: true,
    },
  ],
  // Its own page size: a saved audit pages 1-50 findings (default 10), not
  // the shared list's 1-100.
  flags: [
    { flag: '--limit <n>', summary: 'Findings per page, 1-50 (default 10)' },
    CURSOR_FLAG,
  ],
  examples: [
    'brew-cli emails get-audit 6f1e2d3c-4b5a-4c7d-8e9f-0a1b2c3d4e5f',
    'brew-cli emails get-audit 6f1e2d3c-4b5a-4c7d-8e9f-0a1b2c3d4e5f --limit 20',
  ],
  // The next page is `--cursor <pagination.cursor>`; `pagination.hasMore`
  // says whether one exists.
  run: async ({ ctx, args, flags }) => {
    const limit = flagInt(flags.limit, '--limit')
    const cursor = flagString(flags.cursor)
    const body = await ctx.client().emails.getAudit(args.auditId ?? '', {
      ...(cursor === undefined ? {} : { cursor }),
      ...(limit === undefined ? {} : { limit }),
    })
    return { data: body }
  },
})
