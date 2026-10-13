import type {
  SetUpAppEmailKitInput,
  SetUpAppEmailKitResponse,
} from '@brew.new/sdk'
import { SET_UP_APP_EMAIL_KIT_DEFAULT_TIMEOUT_MS } from '@brew.new/sdk'
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
import { getInvocationPrefix } from '../../lib/invocation'
import { renderTable } from '../../lib/output'

export const appEmailsKitCommand = defineCommand({
  path: ['app-emails', 'kit'],
  summary:
    'Set up and publish the auth + lifecycle starter kit (per-key results; exits 1 when a key failed, re-run to finish)',
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
    const keys = list(flags.keys)
    const sets = list(flags.sets)
    const what =
      keys !== undefined
        ? keys.join(', ')
        : `the ${(sets ?? ['auth', 'lifecycle']).join(' + ')} kit`
    const stack = flagString(flags.stack)
    return `Set up and publish ${what}${stack === undefined ? '' : ` for ${stack}`}${flags.overwrite === true ? ', replacing designs edited in Brew' : ''}: each key sends real email once your code fires it.`
  },
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      sets: list(flags.sets),
      stack: flagString(flags.stack),
      keys: list(flags.keys),
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

function list(value: unknown): string[] | undefined {
  const text = flagString(value)
  if (text === undefined) {
    return
  }
  const items = text
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
