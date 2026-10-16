import { resolve } from 'node:path'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import { flagString } from '../../lib/input'
import { keyPrefixProblem } from '../../lib/migrate/keys'
import {
  MIGRATION_MANIFEST_FILE,
  PHASES,
  type PhaseId,
} from '../../lib/migrate/manifest'
import { runMigration } from '../../lib/migrate/pipeline'
import { MIGRATION_SOURCES } from '../../lib/migrate/resend/source'
import { resolveCwd } from '../../lib/project/process'

const source = MIGRATION_SOURCES.resend

/** `--only templates contacts` or `--only templates,contacts`. */
function parsePhases(value: unknown): PhaseId[] {
  if (value === undefined) {
    return [...PHASES]
  }
  const words = (Array.isArray(value) ? value : [value])
    .flatMap((entry) => String(entry).split(','))
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
  const unknown = words.filter(
    (word) => !(PHASES as readonly string[]).includes(word)
  )
  if (words.length === 0 || unknown.length > 0) {
    throw new CliUsageError(
      `--only takes phases from: ${PHASES.join(', ')}${unknown.length > 0 ? `; got ${unknown.join(', ')}` : ''}.`
    )
  }
  return PHASES.filter((phase) => words.includes(phase))
}

function phaseList(flags: Readonly<Record<string, unknown>>): string {
  try {
    return parsePhases(flags.only).join(', ')
  } catch {
    return 'the chosen phases'
  }
}

export const migrateResendCommand = defineCommand({
  path: ['migrate', 'resend'],
  summary:
    'Move a Resend account and codebase to Brew: plan by default (writes brew.migration.json), --apply to copy templates, contacts, segments, topics, suppressions and draft broadcasts',
  sdkMethod: null,
  derivedFrom: [
    'brand.get',
    'domains.list',
    'appEmails.list',
    'emails.import',
    'appEmails.upsert',
    'emails.delete',
    'contacts.upsertMany',
    'audiences.list',
    'audiences.create',
    'domains.unsubscribes.import',
  ],
  commandClass: 'destructive',
  flags: [
    {
      flag: '--apply',
      summary:
        'Execute the plan: import templates as app emails, upsert contacts, create segment and topic audiences, import suppressions, copy draft broadcasts as Brew drafts (resumes from brew.migration.json)',
    },
    {
      flag: '--dry-run',
      summary: 'Plan and print the report without writing brew.migration.json',
    },
    {
      flag: '--only <phases...>',
      summary: `Run only these phases: ${PHASES.join(', ')}`,
    },
    {
      flag: '--resend-key-stdin',
      summary:
        'Read the Resend API key from stdin (else RESEND_API_KEY); it is never sent to Brew or printed',
    },
    {
      flag: '--cwd <dir>',
      summary:
        'The project to scan and rewrite (default: the current directory)',
    },
    {
      flag: '--domain <domain>',
      summary:
        "Brew domain (id or host) whose unsubscribe list takes Resend's suppressions and unsubscribed contacts",
    },
    {
      flag: '--manifest <path>',
      summary: `Where the plan and progress live (default ${MIGRATION_MANIFEST_FILE})`,
    },
    {
      flag: '--key-prefix <prefix>',
      summary:
        'Prefix for the trigger keys made from template aliases and React Email file names (default none), e.g. resend.',
    },
    {
      flag: '--rewrite-imports',
      summary:
        "With --apply: move files whose every send is a migrated template from 'resend' to '@brew.new/sdk/resend' and write lib/brew-resend-map.ts",
    },
  ],
  examples: [
    'RESEND_API_KEY=re_123 brew-cli migrate resend',
    'printf %s "$RESEND_API_KEY" | brew-cli migrate resend --resend-key-stdin --json',
    'brew-cli migrate resend --only templates code --dry-run',
    'brew-cli migrate resend --apply --yes',
    'brew-cli migrate resend --apply --rewrite-imports --domain news.example.com --yes',
  ],
  confirmSummary: ({ flags }) => {
    if (flags.apply !== true || flags.dryRun === true) {
      return
    }
    return [
      `Copy ${phaseList(flags)} from Resend into your Brew brand: import templates and React Email files as app emails (published where they were), upsert contacts (unsubscribed ones stay unsubscribed), create segment and topic fields and audiences, copy draft broadcasts as Brew drafts (nothing is sent)${flagString(flags.domain) === undefined ? '' : `, add suppressions to ${String(flags.domain)}'s unsubscribe list`}.`,
      flags.rewriteImports === true
        ? "Rewrite 'resend' imports to '@brew.new/sdk/resend' where every send is a migrated template, and write lib/brew-resend-map.ts."
        : '',
      `Progress is saved to ${flagString(flags.manifest) ?? MIGRATION_MANIFEST_FILE}. Nothing in Resend is changed or deleted, and the Resend key is never sent to Brew.`,
    ]
      .filter((part) => part !== '')
      .join(' ')
  },
  run: async ({ ctx, flags }) => {
    const apply = flags.apply === true
    const dryRun = flags.dryRun === true
    if (apply && dryRun) {
      throw new CliUsageError('--apply and --dry-run cannot be combined.')
    }
    const keyPrefix = flagString(flags.keyPrefix) ?? ''
    if (keyPrefix !== '') {
      const problem = keyPrefixProblem(keyPrefix)
      if (problem !== undefined) {
        throw new CliUsageError(`--key-prefix ${keyPrefix}: ${problem}.`)
      }
    }
    const phases = parsePhases(flags.only)
    let sourceKey: { value: string; from: 'stdin' | 'env' } | null = null
    if (flags.resendKeyStdin === true) {
      const text = await ctx.io.readStdin()
      const value = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line !== '')
      if (value === undefined) {
        throw new CliUsageError(
          '--resend-key-stdin read nothing: pipe the Resend API key on stdin.'
        )
      }
      sourceKey = { value, from: 'stdin' }
    } else {
      const value = ctx.io.env[source.envKey]?.trim()
      if (value !== undefined && value !== '') {
        sourceKey = { value, from: 'env' }
      }
    }
    const cwd = resolve(resolveCwd(ctx.io), flagString(flags.cwd) ?? '.')
    return await runMigration(ctx, source, {
      mode: apply ? 'apply' : dryRun ? 'dry-run' : 'plan',
      phases,
      domain: flagString(flags.domain),
      manifestPath: flagString(flags.manifest) ?? MIGRATION_MANIFEST_FILE,
      keyPrefix,
      rewriteImports: flags.rewriteImports === true,
      cwd,
      sourceKey,
    })
  },
})
