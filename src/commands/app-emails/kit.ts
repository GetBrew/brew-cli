import type {
  SetUpAppEmailKitInput,
  SetUpAppEmailKitResponse,
} from '@brew.new/sdk'
import { SET_UP_APP_EMAIL_KIT_DEFAULT_TIMEOUT_MS } from '@brew.new/sdk'
import {
  APP_EMAIL_AUTH_STACKS,
  APP_EMAIL_KIT_KEYS,
  APP_EMAIL_KIT_SETS,
  inlineInput,
  listFlag,
  oneOfFlag,
} from '../../lib/app-email-inputs'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  requestOptions,
} from '../../lib/input'
import { getInvocationPrefix } from '../../lib/invocation'
import { renderTable } from '../../lib/output'

export const appEmailsKitCommand = defineCommand({
  path: ['app-emails', 'kit'],
  summary:
    'Set up and publish the auth + lifecycle starter kit (per-key results; exits 1 when a key failed, re-run to finish). Needs the automations and emails scopes',
  sdkMethod: 'appEmails.setUpKit',
  route: { method: 'POST', path: '/v1/app-emails/kit' },
  commandClass: 'destructive',
  defaultTimeoutMs: SET_UP_APP_EMAIL_KIT_DEFAULT_TIMEOUT_MS,
  flags: [
    {
      flag: '--sets <sets>',
      summary: 'Comma-separated kit sets: auth, lifecycle (default both)',
    },
    {
      flag: '--stack <provider>',
      summary:
        'Auth library: better-auth | authjs | supabase | clerk | firebase | custom (narrows the auth keys, picks the snippets)',
    },
    {
      flag: '--keys <keys>',
      summary:
        'Comma-separated exact kit keys instead of sets (auth.password-reset,lifecycle.welcome)',
    },
    {
      flag: '--domain <domainId>',
      summary:
        'Sending domain id for every key (default: a verified domain per purpose, else the team-only sandbox)',
    },
    {
      flag: '--overwrite',
      summary: 'Replace designs that were edited in Brew since setup',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli app-emails kit --stack better-auth --yes',
    'brew-cli app-emails kit --sets lifecycle --yes --json',
    'brew-cli app-emails kit --keys auth.password-reset,auth.verify-email --domain dom_123 --yes',
  ],
  confirmSummary: ({ flags }) => {
    if (flags.input === '-') {
      // The body comes from stdin, which the gate cannot read ahead.
      return 'Set up and publish the app emails described on stdin (possibly replacing designs edited in Brew): each key sends real email once your code fires it.'
    }
    const inline = inlineInput(flags.input)
    const strings = (value: unknown): string[] | undefined =>
      Array.isArray(value) && value.every((item) => typeof item === 'string')
        ? value
        : undefined
    const keys = selection(flags.keys) ?? strings(inline.keys)
    const sets = selection(flags.sets) ?? strings(inline.sets)
    const what =
      keys !== undefined
        ? keys.join(', ')
        : `the ${(sets ?? ['auth', 'lifecycle']).join(' + ')} kit`
    const stack =
      flagString(flags.stack) ??
      (typeof inline.stack === 'string' ? inline.stack : undefined)
    const overwrites = flags.overwrite === true || inline.overwrite === true
    return `Set up and publish ${what}${stack === undefined ? '' : ` for ${stack}`}${overwrites ? ', replacing designs edited in Brew' : ''}: each key sends real email once your code fires it.`
  },
  run: async ({ ctx, flags }) => {
    const sets = listFlag(flags.sets, '--sets', APP_EMAIL_KIT_SETS)
    const keys = listFlag(flags.keys, '--keys', APP_EMAIL_KIT_KEYS)
    const stack = oneOfFlag(flags.stack, '--stack', APP_EMAIL_AUTH_STACKS)
    if (keys !== undefined && (sets !== undefined || stack !== undefined)) {
      // The API takes `keys` instead of `sets` and `stack`, silently.
      throw new CliUsageError(
        '--keys names exact kit keys: pass it without --sets and --stack.'
      )
    }
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      sets,
      stack,
      keys,
      domainId: flagString(flags.domain),
      overwrite: flags.overwrite === true ? true : undefined,
    })
    const result = await ctx
      .client()
      .appEmails.setUpKit(
        asSdkInput<SetUpAppEmailKitInput>(input),
        requestOptions(flags)
      )
    const failed = result.results.filter((entry) => !entry.ok)
    return {
      data: result,
      human: renderKit(result, getInvocationPrefix(ctx.io.env)),
      ...(failed.length > 0 ? { exitCode: 1 } : {}),
    }
  },
})

/** A list flag for the confirmation summary only (validated in `run`). */
function selection(value: unknown): string[] | undefined {
  const items = (flagString(value) ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')
  return items.length === 0 ? undefined : items
}

function renderKit(result: SetUpAppEmailKitResponse, prefix: string): string {
  const rows = result.results.map((entry) =>
    entry.ok
      ? {
          key: entry.triggerKey,
          status: entry.published ? 'published' : 'saved',
          sender: entry.sender.mode,
        }
      : {
          key: entry.triggerKey,
          status: `failed: ${entry.error.code}`,
          sender: '',
        }
  )
  const failed = result.results.filter((entry) => !entry.ok).length
  const lines = [
    renderTable(rows, [
      { key: 'key', header: 'KEY' },
      { key: 'status', header: 'STATUS' },
      { key: 'sender', header: 'SENDER' },
    ]),
    '',
    `Stack ${result.stack.provider} (${result.stack.authDelivery}): ${result.stack.note}`,
  ]
  for (const snippet of result.stack.snippets) {
    lines.push(`Snippet: ${snippet.title} (${snippet.file})`)
  }
  if (failed > 0) {
    lines.push(
      '',
      `${failed} key${failed === 1 ? '' : 's'} failed. Run \`${prefix} app-emails kit\` again with the same flags to finish them.`
    )
  }
  return lines.join('\n')
}
