import {
  type BrowserLoginResult,
  type PendingLoginView,
  resumeBrowserLogin,
  startBrowserLogin,
} from '../lib/auth-flow/login'
import { printable } from '../lib/auth-flow/session'
import {
  buildSdkClient,
  DEFAULT_API_URL,
  LOGIN_KEYS_URL,
  maskApiKey,
  resolveAuth,
} from '../lib/client'
import { readConfig, updateConfig } from '../lib/config-store'
import { sdkTransportFor } from '../lib/context'
import { type CommandOutcome, defineCommand } from '../lib/define-command'
import { CliApiError, CliUsageError, EXIT_AUTH } from '../lib/errors'
import { getInvocationPrefix } from '../lib/invocation'
import { progress } from '../lib/output'
import { parseDurationFlag } from '../lib/transport'
import type { CliContext } from '../lib/types'

const KEY_SHAPE = /^brew_[a-z0-9]{16,64}$/

/** How the key reached the CLI, reported as `method`. */
type KeyMethod = 'api-key' | 'stdin' | 'paste'

type LoginPlan =
  | { readonly kind: 'key'; readonly isPaste: boolean }
  | {
      readonly kind: 'browser'
      readonly isResume: boolean
      readonly openBrowser: boolean
      /** Undefined: until the session expires; 0: `--no-wait`. */
      readonly waitMs: number | undefined
    }

export const loginCommand = defineCommand({
  path: ['login'],
  summary: 'Sign in through the browser, or store an API key, for this machine',
  sdkMethod: null,
  commandClass: 'write',
  flags: [
    {
      flag: '--browser',
      summary:
        'Sign in through the browser (the default on an interactive terminal)',
    },
    {
      flag: '--paste',
      summary: 'Paste an API key instead (or pipe one on stdin)',
    },
    {
      flag: '--no-open',
      summary: 'Print the sign-in link and code without opening a browser',
    },
    {
      flag: '--wait <duration>',
      summary:
        'Wait at most this long for approval (90s, 5m), then exit 3 with a pending result to --resume',
    },
    {
      flag: '--no-wait',
      summary:
        'Print the sign-in link and code, and exit 3 at once with a pending result (agents: with --json, then --resume)',
    },
    {
      flag: '--resume',
      summary: 'Collect the pending browser sign-in started with --no-wait',
    },
  ],
  examples: [
    'brew-cli login',
    'brew-cli login --no-wait --json',
    'brew-cli login --resume',
    'brew-cli login --no-open',
    'brew-cli login --api-key brew_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    'echo "$BREW_API_KEY" | brew-cli login',
  ],
  run: async ({ ctx, flags }) => {
    const plan = planLogin(ctx, flags)
    if (plan.kind === 'browser') {
      return await browserLogin(ctx, plan)
    }
    return await keyLogin(ctx, plan.isPaste)
  },
})

/**
 * Picks the sign-in method from the flags. A key from `--api-key` or stdin
 * keeps the old path; an interactive terminal with neither signs in through
 * the browser; contradictory flags are a usage error (exit 2).
 */
function planLogin(
  ctx: CliContext,
  flags: Readonly<Record<string, unknown>>
): LoginPlan {
  // `--wait <d>` and `--no-wait` share one commander value (the last one
  // wins), so the pair is told apart by what was typed.
  const saysWait = ctx.rawArgv.some(
    (token) => token === '--wait' || token.startsWith('--wait=')
  )
  const saysNoWait = ctx.rawArgv.includes('--no-wait')
  if (saysWait && saysNoWait) {
    throw new CliUsageError('--wait and --no-wait cannot be combined.')
  }
  const browserFlags = [
    ...(flags.browser === true ? ['--browser'] : []),
    ...(flags.open === false ? ['--no-open'] : []),
    ...(saysWait ? ['--wait'] : []),
    ...(saysNoWait ? ['--no-wait'] : []),
    ...(flags.resume === true ? ['--resume'] : []),
  ]
  const isPaste = flags.paste === true
  if (ctx.globals.apiKey !== undefined) {
    const others = [...(isPaste ? ['--paste'] : []), ...browserFlags]
    if (others.length > 0) {
      throw new CliUsageError(
        `--api-key cannot be combined with ${others.join(', ')}.`
      )
    }
    return { kind: 'key', isPaste: false }
  }
  if (isPaste) {
    if (browserFlags.length > 0) {
      throw new CliUsageError(
        `--paste cannot be combined with ${browserFlags.join(', ')}.`
      )
    }
    return { kind: 'key', isPaste: true }
  }
  if (browserFlags.length === 0 && !ctx.io.isTtyIn) {
    return { kind: 'key', isPaste: false }
  }
  return {
    kind: 'browser',
    isResume: flags.resume === true,
    openBrowser: flags.open !== false,
    waitMs: saysNoWait
      ? 0
      : typeof flags.wait === 'string'
        ? parseDurationFlag(flags.wait, '--wait')
        : undefined,
  }
}

async function browserLogin(
  ctx: CliContext,
  plan: Extract<LoginPlan, { kind: 'browser' }>
): Promise<CommandOutcome> {
  const prefix = getInvocationPrefix(ctx.io.env)
  const commands = {
    resumeCommand: `${prefix} login --resume${ctx.mode === 'json' ? ' --json' : ''}`,
    restartCommand: `${prefix} login`,
  }
  const result: BrowserLoginResult = plan.isResume
    ? await resumeBrowserLogin(ctx, { waitMs: plan.waitMs, ...commands })
    : await startBrowserLogin(ctx, {
        keys: ['cli'],
        openBrowser: plan.openBrowser,
        waitMs: plan.waitMs,
        ...commands,
      })
  if (result.status === 'pending') {
    return pendingOutcome(result.pending)
  }
  const { approved, apiUrl } = result
  const cliKey = approved.keys.cli
  if (cliKey === undefined) {
    throw new CliApiError({
      status: 200,
      code: 'CLI_LOGIN_SEAL_INVALID',
      type: 'internal_error',
      message: 'The approved sign-in carried no CLI key.',
      suggestion: `Run \`${commands.restartCommand}\` again.`,
    })
  }
  const path = updateConfig(ctx.io.env, {
    apiKey: cliKey.key,
    // The key is bound to this brand; a stale brand id would make every
    // request a 403 BRAND_SCOPE_MISMATCH.
    brandId: approved.brand.brandId,
    userEmail: approved.approver.email,
    brandName: approved.brand.name,
    // The key lives on the server that minted it: a sign-in against
    // staging or a local dev server keeps sending there.
    apiUrl: apiUrl === DEFAULT_API_URL ? undefined : apiUrl,
  })
  // Who approved is the check against a phished approval: shown even
  // under --quiet (JSON output carries it as `userEmail`).
  const signedIn = `Signed in as ${printable(approved.approver.email)} to ${printable(approved.brand.name)}. Key stored in ${path} (0600).`
  if (ctx.mode === 'json') {
    progress(ctx, signedIn)
  } else {
    ctx.io.stderr.write(`${signedIn}\n`)
  }
  warnIfEnvKeyWins(ctx)
  return {
    data: {
      loggedIn: true,
      method: 'browser',
      apiKey: maskApiKey(cliKey.key),
      apiUrl,
      configPath: path,
      brandId: approved.brand.brandId,
      brandName: approved.brand.name,
      userEmail: approved.approver.email,
      keyId: cliKey.keyId,
    },
  }
}

function pendingOutcome(pending: PendingLoginView): CommandOutcome {
  return {
    data: pending,
    human: [
      `Sign-in pending. Approve it at ${printable(pending.verificationUrl)} (code ${printable(pending.userCode)}),`,
      `then run: ${pending.resumeCommand}`,
    ].join('\n'),
    exitCode: EXIT_AUTH,
  }
}

async function keyLogin(
  ctx: CliContext,
  isPaste: boolean
): Promise<CommandOutcome> {
  const { key: candidate, method } = await readCandidateKey(ctx, isPaste)
  if (!KEY_SHAPE.test(candidate)) {
    progress(
      ctx,
      'Warning: key does not look like a Brew API key (brew_…); validating anyway.'
    )
  }
  const auth = resolveAuth({
    globals: { ...ctx.globals, apiKey: candidate },
    env: ctx.io.env,
  })
  // Throws a 401 BrewApiError (exit 3) when the key is invalid.
  await buildSdkClient(auth, sdkTransportFor(ctx)).usage.get()
  // A pasted key says nothing about who approved it: forget the identity
  // a browser sign-in stored, and the brand that sign-in's key was bound to.
  const browserBrand = readConfig(ctx.io.env).brandName !== undefined
  const path = updateConfig(ctx.io.env, {
    apiKey: candidate,
    userEmail: undefined,
    brandName: undefined,
    ...(browserBrand ? { brandId: undefined } : {}),
  })
  progress(ctx, `Logged in. Key stored in ${path} (0600).`)
  return {
    data: {
      loggedIn: true,
      method,
      apiKey: maskApiKey(candidate),
      apiUrl: auth.apiUrl,
      configPath: path,
    },
  }
}

async function readCandidateKey(
  ctx: CliContext,
  isPaste: boolean
): Promise<{ readonly key: string; readonly method: KeyMethod }> {
  if (ctx.globals.apiKey !== undefined) {
    return { key: ctx.globals.apiKey, method: 'api-key' }
  }
  if (!ctx.io.isTtyIn) {
    const piped = (await ctx.io.readStdin()).trim()
    if (piped !== '') {
      return { key: piped, method: 'stdin' }
    }
    const prefix = getInvocationPrefix(ctx.io.env)
    throw new CliUsageError(
      isPaste
        ? `No key provided. Pipe the key on stdin or pass --api-key. Create keys at ${LOGIN_KEYS_URL}`
        : `No key provided. Pass --api-key, pipe the key on stdin, or sign in through the browser with \`${prefix} login --browser\` (agents: \`${prefix} login --no-wait --json\`, then \`${prefix} login --resume\`). Create keys at ${LOGIN_KEYS_URL}`
    )
  }
  progress(ctx, `Create an API key at ${LOGIN_KEYS_URL}`)
  const answer = (await ctx.io.readLine('Paste your API key: ')).trim()
  if (answer === '') {
    throw new CliUsageError('No key entered.')
  }
  return { key: answer, method: 'paste' }
}

function warnIfEnvKeyWins(ctx: CliContext): void {
  const fromEnv = ctx.io.env.BREW_API_KEY
  if (fromEnv !== undefined && fromEnv !== '') {
    progress(
      ctx,
      'Note: BREW_API_KEY is set in this environment and takes precedence over the stored key.'
    )
  }
}
