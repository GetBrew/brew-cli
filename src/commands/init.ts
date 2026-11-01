import type { AppEmailKitSet, AppEmailKitStackProvider } from '@brew.new/sdk'
import { defineCommand } from '../lib/define-command'
import { CliUsageError } from '../lib/errors'
import { runInit } from '../lib/init/pipeline'
import { flagString } from '../lib/input'

const SETS: readonly AppEmailKitSet[] = ['auth', 'lifecycle']
const STACKS: readonly AppEmailKitStackProvider[] = [
  'better-auth',
  'authjs',
  'supabase',
  'clerk',
  'firebase',
  'custom',
]

function parseSets(value: unknown): AppEmailKitSet[] | undefined {
  const text = flagString(value)
  if (text === undefined) {
    return
  }
  const items = text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')
  const unknown = items.filter(
    (item) => !(SETS as readonly string[]).includes(item)
  )
  if (items.length === 0 || unknown.length > 0) {
    throw new CliUsageError(
      `--sets takes auth, lifecycle or both (comma-separated); got "${text}".`
    )
  }
  return [...new Set(items)] as AppEmailKitSet[]
}

function parseStack(value: unknown): AppEmailKitStackProvider | undefined {
  const text = flagString(value)
  if (text === undefined) {
    return
  }
  if (!(STACKS as readonly string[]).includes(text)) {
    throw new CliUsageError(
      `--stack takes one of ${STACKS.join(', ')}; got "${text}".`
    )
  }
  return text as AppEmailKitStackProvider
}

/**
 * `--apply-patches id@hash,…`: each id with the hash prefix (12+ hex) of
 * the file it was computed from, as the report's nextSteps print it.
 */
function parsePatchPins(value: unknown): ReadonlyMap<string, string> {
  const text = flagString(value)
  const pins = new Map<string, string>()
  if (text === undefined) {
    return pins
  }
  for (const item of text.split(',')) {
    const match = /^([a-z0-9-]+)@([0-9a-f]{12,64})$/.exec(item.trim())
    if (match?.[1] === undefined || match[2] === undefined) {
      throw new CliUsageError(
        `--apply-patches takes <id>@<hash> pairs from the report's nextSteps (e.g. better-auth-config@3f9c2a7d1b04); got "${item.trim()}".`
      )
    }
    pins.set(match[1], match[2])
  }
  return pins
}

function parseAppUrl(value: unknown): string | undefined {
  const text = flagString(value)
  if (text === undefined) {
    return
  }
  try {
    const url = new URL(text)
    if (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      url.username === '' &&
      url.password === '' &&
      text.length <= 512
    ) {
      return text
    }
  } catch {
    // reported below
  }
  throw new CliUsageError(
    `--app-url takes an http(s) URL without credentials; got "${text}".`
  )
}

export const initCommand = defineCommand({
  path: ['init'],
  summary:
    'Set up Brew app email in this project: sign in, starter kit, SDK, lib/brew.ts, .env.local, MCP, a sandbox test email',
  sdkMethod: null,
  derivedFrom: [
    'brand.get',
    'domains.list',
    'domains.add',
    'appEmails.setUpKit',
    'automations.triggers.list',
    'automations.triggers.getContract',
    'send',
  ],
  commandClass: 'destructive',
  flags: [
    {
      flag: '--dry-run',
      summary:
        'Plan only: detect, read, and report every change (--json for the plan); no writes, no sign-in, no mutating requests',
    },
    {
      flag: '--app <dir>',
      summary: 'The app to set up inside a monorepo (relative to the cwd)',
    },
    {
      flag: '--domain <host>',
      summary:
        'Add this sending domain and print its DNS records (init does not wait for verification)',
    },
    {
      flag: '--sets <sets>',
      summary: 'Kit sets to set up: auth, lifecycle (default both)',
    },
    {
      flag: '--stack <provider>',
      summary:
        'Auth stack for the kit (default: detected): better-auth | authjs | supabase | clerk | firebase | custom',
    },
    {
      flag: '--test-to <email>',
      summary:
        'Send the test email here (default: the person who signed in; the sandbox reaches your Brew team only)',
    },
    {
      flag: '--apply-patches <patches>',
      summary:
        'Apply reviewed patches to your auth config: comma-separated <id>@<hash> from the report (each applies only while its file is unchanged since that report)',
    },
    {
      flag: '--app-url <url>',
      summary:
        "Your app's URL, shown on the brew.new approval page so the right brand is picked",
    },
    { flag: '--no-install', summary: 'Do not install @brew.new/sdk' },
    { flag: '--no-mcp', summary: 'Do not configure MCP for detected editors' },
    {
      flag: '--no-agent-files',
      summary: 'Do not write the AGENTS.md block or the skill files',
    },
    { flag: '--no-test-email', summary: 'Do not send the sandbox test email' },
    {
      flag: '--no-wait',
      summary:
        'If a sign-in is needed, exit 3 at once with its link and code (agents), then run the resume command',
    },
    {
      flag: '--resume',
      summary: 'Collect the sign-in started with --no-wait, then continue',
    },
    {
      flag: '--no-open',
      summary: 'Print the sign-in link without opening a browser',
    },
  ],
  examples: [
    'brew-cli init',
    'brew-cli init --dry-run --json',
    'brew-cli init --yes --json',
    'brew-cli init --yes --no-wait --json',
    'brew-cli init --resume --yes --json',
    'brew-cli init --app apps/web --domain mail.example.com --yes',
    'brew-cli init --yes --apply-patches better-auth-config@3f9c2a7d1b04',
  ],
  confirmSummary: ({ flags }) => {
    if (flags.dryRun === true) {
      return
    }
    return [
      'Set up Brew in this project:',
      'sign in if needed (an app key goes into .env.local, 0600, git-ignored);',
      `set up and publish the ${parseSets(flags.sets)?.join(' + ') ?? 'auth + lifecycle'} app emails;`,
      flags.install === false ? '' : 'install @brew.new/sdk;',
      'write lib/brew.ts and friends (create-only, never over your edits)',
      flags.applyPatches !== undefined
        ? 'and apply the reviewed auth config patches;'
        : 'and print patches for your auth config;',
      flags.testEmail === false ? '' : 'then send you a sandbox test email.',
    ]
      .filter((part) => part !== '')
      .join(' ')
  },
  run: async ({ ctx, args, flags }) => {
    const resume = flags.resume === true
    const noWait = ctx.rawArgv.includes('--no-wait')
    if (resume && flags.dryRun === true) {
      throw new CliUsageError('--resume cannot be combined with --dry-run.')
    }
    return await runInit(ctx, {
      dryRun: flags.dryRun === true,
      app: flagString(flags.app),
      domain: flagString(flags.domain),
      sets: parseSets(flags.sets),
      stack: parseStack(flags.stack),
      install: flags.install !== false,
      mcp: flags.mcp !== false,
      agentFiles: flags.agentFiles !== false,
      testEmail: flags.testEmail !== false,
      testTo: flagString(flags.testTo),
      applyPatches: parsePatchPins(flags.applyPatches),
      appUrl: parseAppUrl(flags.appUrl),
      noWait,
      resume,
      openBrowser: flags.open !== false,
      rerun: { command: initCommand, invocation: { args, flags } },
    })
  },
})
