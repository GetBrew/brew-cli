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
  toStringArray,
} from '../../lib/input'
import { getInvocationPrefix } from '../../lib/invocation'
import { renderTable } from '../../lib/output'
import { keepsSending } from './upsert'

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
        'Sending domain id for every key (default: a verified domain per purpose, else the team-only sandbox). Keys of the other purpose fail with APP_EMAIL_DOMAIN_PURPOSE_MISMATCH',
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
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {
      sets,
      stack,
      keys,
      domainId: flagString(flags.domain),
      overwrite: flags.overwrite === true ? true : undefined,
    })
    if (
      input.keys !== undefined &&
      (input.sets !== undefined || input.stack !== undefined)
    ) {
      // The API takes `keys` instead of `sets` and `stack`, silently.
      throw new CliUsageError(
        '--keys names exact kit keys: pass it without --sets and --stack, as flags or in --input.'
      )
    }
    const result = await ctx
      .client()
      .appEmails.setUpKit(
        asSdkInput<SetUpAppEmailKitInput>(input),
        requestOptions(flags)
      )
    const failed = result.results.filter((entry) => !entry.ok)
    return {
      data: result,
      human: renderKit(
        result,
        getInvocationPrefix(ctx.io.env),
        flags.idempotencyKey !== undefined
      ),
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

function renderKit(
  result: SetUpAppEmailKitResponse,
  prefix: string,
  keyed: boolean
): string {
  const rows = result.results.map((entry) =>
    entry.ok
      ? {
          key: entry.triggerKey,
          status: entry.published
            ? 'published'
            : keepsSending(entry)
              ? 'draft saved, published version sends'
              : 'saved',
          sender: entry.sender.mode,
        }
      : {
          key: entry.triggerKey,
          status: `failed: ${entry.error.code}`,
          sender: '',
        }
  )
  const lines = [
    renderTable(rows, [
      { key: 'key', header: 'KEY' },
      { key: 'status', header: 'STATUS' },
      { key: 'sender', header: 'SENDER' },
    ]),
    '',
    `Stack ${result.stack.provider} (${result.stack.authDelivery}): ${result.stack.note}`,
  ]
  const warnings = result.results.flatMap((entry) =>
    entry.ok
      ? entry.warnings.map(
          (warning) => `${entry.triggerKey}: warning: ${warning.message}`
        )
      : []
  )
  if (warnings.length > 0) {
    lines.push('', ...warnings)
  }
  for (const snippet of result.stack.snippets) {
    lines.push('', `Snippet: ${snippet.title} (${snippet.file})`, snippet.code)
  }
  const hints = kitFailureHints(
    result.results.flatMap((entry) => (entry.ok ? [] : [entry])),
    prefix
  )
  if (hints.length > 0) {
    lines.push('', ...hints)
    if (keyed) {
      // The API stores this response under the key: a same-key re-run
      // gets it back instead of retrying the failed keys.
      lines.push(
        'A re-run with the same --idempotency-key replays this result for 24 hours: pass a new key.'
      )
    }
  }
  return lines.join('\n')
}

/**
 * What to do about each failed key. Running the kit again finishes a key
 * that failed part way, but not one the API refused for a reason a re-run
 * keeps: those name the change to make first.
 */
function kitFailureHints(
  failures: ReadonlyArray<{
    readonly triggerKey: string
    readonly error: {
      readonly code: string
      readonly details?: Readonly<Record<string, unknown>>
    }
  }>,
  prefix: string
): string[] {
  const keysWith = (code: string) =>
    failures
      .filter((entry) => entry.error.code === code)
      .map((entry) => entry.triggerKey)
  const hints: string[] = []
  const mismatched = keysWith('APP_EMAIL_DOMAIN_PURPOSE_MISMATCH')
  if (mismatched.length > 0) {
    hints.push(
      `${mismatched.join(', ')}: a kit key never sends from a domain of the other purpose (auth, trial ending and payment failed are transactional; welcome and win-back are marketing). Run \`${prefix} app-emails kit\` again without --domain, or with a --domain of their purpose.`
    )
  }
  const inUse = keysWith('APP_EMAIL_TRIGGER_IN_USE')
  if (inUse.length > 0) {
    const automations = failures.flatMap((entry) =>
      entry.error.code === 'APP_EMAIL_TRIGGER_IN_USE'
        ? (toStringArray(entry.error.details?.automationIds) ?? [])
        : []
    )
    hints.push(
      `${inUse.join(', ')}: the trigger already starts a published automation no setup made, so every send would go out twice. Unpublish or delete ${automations.length > 0 ? automations.join(', ') : 'those automations'}, then run the kit again.`
    )
  }
  const edited = keysWith('APP_EMAIL_EDITED_IN_BREW')
  if (edited.length > 0) {
    hints.push(
      `${edited.join(', ')}: edited in Brew since setup. Keep the edits, or run the kit again with --overwrite.`
    )
  }
  const handled = new Set([...mismatched, ...inUse, ...edited])
  const rest = failures.filter((entry) => !handled.has(entry.triggerKey))
  if (rest.length > 0) {
    hints.push(
      `${rest.length} key${rest.length === 1 ? '' : 's'} failed. Run \`${prefix} app-emails kit\` again with the same flags to finish them.`
    )
  }
  return hints
}
