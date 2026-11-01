import { extname } from 'node:path'
import type { UpsertAppEmailInput, UpsertAppEmailResponse } from '@brew.new/sdk'
import { UPSERT_APP_EMAIL_DEFAULT_TIMEOUT_MS } from '@brew.new/sdk'
import {
  APP_EMAIL_SOURCE_FORMATS,
  inlineInput,
  oneOfFlag,
} from '../../lib/app-email-inputs'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  readTextFlag,
} from '../../lib/input'
import { getInvocationPrefix } from '../../lib/invocation'
import { triggerKeyArg } from '../../lib/trigger-key'

const FORMAT_BY_EXTENSION: Readonly<Record<string, 'html' | 'jsx' | 'mjml'>> = {
  '.htm': 'html',
  '.html': 'html',
  '.jsx': 'jsx',
  '.mjml': 'mjml',
  '.tsx': 'jsx',
}

export const appEmailsUpsertCommand = defineCommand({
  path: ['app-emails', 'upsert'],
  summary:
    'Set up one app email by key in one idempotent call (trigger, contract, design, automation) and publish it. Needs the automations and emails scopes',
  sdkMethod: 'appEmails.upsert',
  route: { method: 'PUT', path: '/v1/app-emails/{triggerKey}' },
  commandClass: 'destructive',
  defaultTimeoutMs: UPSERT_APP_EMAIL_DEFAULT_TIMEOUT_MS,
  args: [
    {
      name: 'triggerKey',
      summary:
        'Trigger key your code sends by: a kit key (auth.password-reset) or your own (order.paid)',
      isRequired: true,
    },
  ],
  flags: [
    {
      flag: '--starter <id>',
      summary:
        'Starter-kit template to use (a kit key alone uses its own starter)',
    },
    {
      flag: '--source-file <path>',
      summary:
        'Your own design source (HTML, MJML or React Email JSX), or - for stdin',
    },
    {
      flag: '--format <format>',
      summary:
        'Source format: html | mjml | jsx (default: from the file extension)',
    },
    { flag: '--title <title>', summary: 'App email title in Brew' },
    { flag: '--subject <text>', summary: 'Subject line' },
    { flag: '--preview-text <text>', summary: 'Inbox preview text' },
    {
      flag: '--domain <domainId>',
      summary:
        'Sending domain id (default: a verified domain for the purpose, else the team-only sandbox). A kit key refuses a domain of the other purpose (transactional: auth, trial ending, payment failed; marketing: welcome, win-back)',
    },
    // `--publish` comes first so the default stays unset: Commander gives a
    // lone `--no-publish` a default of true.
    {
      flag: '--publish',
      summary:
        'Publish it even if it was unpublished in Brew since setup, which a re-run otherwise leaves off',
    },
    {
      flag: '--no-publish',
      summary: 'Save the setup without publishing the automation',
    },
    {
      flag: '--overwrite',
      summary: 'Replace a design that was edited in Brew since setup',
    },
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli app-emails upsert auth.password-reset --yes',
    'brew-cli app-emails upsert order.paid --source-file emails/order-paid.tsx --subject "Your order is confirmed" --yes',
    'brew-cli app-emails upsert lifecycle.welcome --overwrite --yes',
    `brew-cli app-emails upsert account.sign-in-code --source-file emails/sign-in-code.tsx --input '{"payloadSchema":{"fields":[{"key":"code","type":"string","required":true,"secret":true}]}}' --yes`,
  ],
  confirmSummary: ({ args, flags }) => {
    if (flags.input === '-') {
      // stdin may set `overwrite` or `publish`; the gate cannot read it ahead.
      return `Set up app email ${args.triggerKey ?? ''} from the body on stdin, which may publish it (\`send\` then sends real email) or replace a design edited in Brew.`
    }
    const inline = inlineInput(flags.input)
    const publishes = flags.publish !== false && inline.publish !== false
    const overwrites = flags.overwrite === true || inline.overwrite === true
    if (!(publishes || overwrites)) {
      return
    }
    const key = args.triggerKey ?? ''
    const parts = [
      `Set up app email ${key}`,
      overwrites ? ', replacing a design edited in Brew,' : '',
      publishes
        ? ` and publish it: \`send ${key}\` sends real email from then on.`
        : ' without publishing it.',
    ]
    return parts.join('')
  },
  run: async ({ ctx, args, flags }) => {
    const triggerKey = triggerKeyArg(args.triggerKey, 'The app email key')
    if (flags.input === '-' && flags.sourceFile === '-') {
      throw new CliUsageError(
        'Only one of --input and --source-file can read stdin.'
      )
    }
    const explicitFormat = oneOfFlag(
      flags.format,
      '--format',
      APP_EMAIL_SOURCE_FORMATS
    )
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const sourcePath = flagString(flags.sourceFile)
    const content = await readTextFlag(ctx, sourcePath, '--source-file')
    let source: { format: string; content: string } | undefined
    if (content !== undefined) {
      const format =
        explicitFormat ??
        (sourcePath === undefined || sourcePath === '-'
          ? undefined
          : FORMAT_BY_EXTENSION[extname(sourcePath).toLowerCase()])
      if (format === undefined) {
        throw new CliUsageError(
          '--format is required for this source: html | mjml | jsx.'
        )
      }
      source = { format, content }
    } else if (explicitFormat !== undefined) {
      throw new CliUsageError('--format applies to --source-file only.')
    }
    const input = mergeInput(base, {
      starter: flagString(flags.starter),
      source,
      title: flagString(flags.title),
      subject: flagString(flags.subject),
      previewText: flagString(flags.previewText),
      domainId: flagString(flags.domain),
      publish: typeof flags.publish === 'boolean' ? flags.publish : undefined,
      overwrite: flags.overwrite === true ? true : undefined,
    })
    if (input.starter !== undefined && input.source !== undefined) {
      throw new CliUsageError(
        'Pass --starter or --source-file, not both: one design per app email.'
      )
    }
    const result = await ctx.client().appEmails.upsert(
      asSdkInput<UpsertAppEmailInput>({
        ...input,
        triggerKey,
      })
    )
    return {
      data: result,
      human: renderSetup(result, getInvocationPrefix(ctx.io.env)),
    }
  },
})

/**
 * A live automation with a newer draft keeps sending its published
 * version: `published` is false, yet a send still goes out.
 */
export function keepsSending(
  result: Pick<UpsertAppEmailResponse, 'published' | 'warnings'>
): boolean {
  return (
    !result.published &&
    result.warnings.some((warning) => warning.code === 'DRAFT_SAVED_NOT_LIVE')
  )
}

export function renderSetup(
  result: Pick<
    UpsertAppEmailResponse,
    'triggerKey' | 'published' | 'created' | 'sender' | 'warnings'
  >,
  prefix: string
): string {
  const made = Object.entries(result.created)
    .filter(([, created]) => created)
    .map(([piece]) => piece)
  const sender =
    result.sender.mode === 'sandbox'
      ? `sandbox ${result.sender.from} (team only until a domain verifies)`
      : `${result.sender.from}`
  const sends = keepsSending(result)
  const state = result.published
    ? 'published'
    : sends
      ? 'draft saved, the published version keeps sending'
      : 'saved, not published'
  const lines = [
    `${result.triggerKey}: ${state}; sender ${sender}.`,
    made.length === 0
      ? 'Nothing new: every piece already existed.'
      : `Created: ${made.join(', ')}.`,
  ]
  for (const warning of result.warnings) {
    lines.push(`warning: ${warning.message}`)
  }
  if (result.published || sends) {
    lines.push(`Send it: ${prefix} send ${result.triggerKey} --to <email>`)
  }
  return lines.join('\n')
}
