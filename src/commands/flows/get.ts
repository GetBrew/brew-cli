import type { Flow } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { flagString } from '../../lib/input'
import { renderTable } from '../../lib/output'

/**
 * One public flow by its brand domain: the bare row with `anchor` and every
 * step. `flows list` finds the slug; this reads the sequence. Organization-
 * wide, so the SDK never sends the brand binding.
 */
export const flowsGetCommand = defineCommand({
  path: ['flows', 'get'],
  summary:
    'Fetch one public email flow by brand domain, with every step (day offset, wait, subject, template id)',
  sdkMethod: 'flows.get',
  route: { method: 'GET', path: '/v1/flows/{slug}' },
  commandClass: 'read',
  args: [
    {
      name: 'slug',
      summary:
        'The slug a `flows list` card carries: a brand domain (brew.new) or <domain>/<kind> (brew.new/welcome)',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--include <keys>',
      summary:
        'Comma-separated expansions: html (each step’s rendered HTML, best-effort per step)',
    },
    {
      flag: '--kind <kind>',
      summary:
        'One send stream’s flow for a bare-domain slug (e.g. welcome); a <domain>/<kind> slug already names it',
    },
  ],
  examples: [
    'brew-cli flows get brew.new',
    'brew-cli flows get brew.new --include html --json',
    'brew-cli flows get brew.new/welcome',
  ],
  run: async ({ ctx, args, flags }) => {
    const include = flagString(flags.include)
    const kind = flagString(flags.kind)
    const options = {
      ...(include === undefined ? {} : { include }),
      ...(kind === undefined ? {} : { kind }),
    }
    const flow = await ctx
      .client()
      .flows.get(
        args.slug ?? '',
        Object.keys(options).length > 0 ? options : undefined
      )
    return { data: flow, human: renderSteps(flow) }
  },
})

function renderSteps(flow: Flow): string {
  const header = `${flow.title} — ${flow.brand.name} (${flow.slug}), ${flow.emailCount} emails over ${flow.spanDays} days${flow.anchor === undefined ? '' : `, day 0 = ${flow.anchor}`}`
  const table = renderTable(
    (flow.steps ?? []).map((step) => ({
      order: step.order,
      day: step.dayOffset,
      wait: step.delayDays,
      subject: step.subject,
      category: step.category,
      emailId: step.emailId,
    })),
    [
      { key: 'order', header: '#' },
      { key: 'day', header: 'DAY' },
      { key: 'wait', header: 'WAIT' },
      { key: 'subject', header: 'SUBJECT' },
      { key: 'category', header: 'CATEGORY' },
      { key: 'emailId', header: 'TEMPLATE' },
    ]
  )
  return `${header}\n\n${table}`
}
