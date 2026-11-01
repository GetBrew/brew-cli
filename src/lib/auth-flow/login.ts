import { resolveAuth } from '../client'
import { CliApiError, CliAuthError } from '../errors'
import { progress } from '../output'
import type { CliContext } from '../types'
import { type OpenOutcome, openVerificationPage } from './open-browser'
import {
  deletePendingLogin,
  type PendingLogin,
  readPendingLogin,
  writePendingLogin,
} from './pending'
import {
  type ActiveLogin,
  type ApprovedLogin,
  FINAL_LOGIN_CODES,
  type WaitOutcome,
  waitForApproval,
} from './poll'
import {
  exportPrivateJwk,
  generateLoginKeyPair,
  generatePollSecret,
  hashPollSecret,
  importPrivateJwk,
  type LoginKeyKind,
} from './seal'
import {
  type CreatedSession,
  cleanClientInfo,
  createSession,
  defaultClientInfo,
  type LoginClientInfo,
  printable,
  siteUrlFromApiUrl,
} from './session'

/**
 * Browser sign-in (an RFC 8628-shaped device flow): start a session, show
 * its link and code, open the approval page where there is a browser, poll
 * for the sealed keys and open them. Shared by `login` and, later, `init`,
 * which asks for an app key too and keeps it in memory only.
 */

export type BrowserLoginOptions = {
  readonly keys: readonly LoginKeyKind[]
  /** Merged over this machine's own facts (`project`, `appUrl` for init). */
  readonly client?: LoginClientInfo
  readonly openBrowser: boolean
  /** Undefined: until the session expires. `0`: return pending at once. */
  readonly waitMs: number | undefined
  /** Collects a pending sign-in (`brew-cli login --resume`). */
  readonly resumeCommand: string
  /** Starts over (`brew-cli login`). */
  readonly restartCommand: string
}

/** The machine-readable "approve it, then resume" result (exit 3). */
export type PendingLoginView = {
  readonly status: 'pending'
  readonly verificationUrl: string
  readonly userCode: string
  readonly expiresAt: string
  readonly resumeCommand: string
}

export type BrowserLoginResult =
  | {
      readonly status: 'approved'
      readonly approved: ApprovedLogin
      /** The API URL the keys belong to. */
      readonly apiUrl: string
    }
  | { readonly status: 'pending'; readonly pending: PendingLoginView }

export async function startBrowserLogin(
  ctx: CliContext,
  options: BrowserLoginOptions
): Promise<BrowserLoginResult> {
  const { apiUrl } = resolveAuth({
    globals: ctx.globals,
    env: ctx.io.env,
    allowAnonymous: true,
  })
  const siteUrl = siteUrlFromApiUrl(apiUrl)
  const keyPair = await generateLoginKeyPair()
  const pollSecret = generatePollSecret()
  const session = await createSession(ctx, {
    siteUrl,
    publicKey: keyPair.publicJwk,
    pollSecretHash: hashPollSecret(pollSecret),
    keys: options.keys,
    client: cleanClientInfo({ ...defaultClientInfo(), ...options.client }),
  })
  const isNoWait = options.waitMs === 0
  // Without --no-wait the link and code are the only way to finish, so
  // they print even under --quiet; with it, the result carries them.
  const isSilent = isNoWait && ctx.globals.quiet
  if (!isSilent) {
    ctx.io.stderr.write(`${instructionLines(session).join('\n')}\n`)
  }
  const opened = await openVerificationPage(ctx.io, session.verificationUrl, {
    isDisabled: !options.openBrowser,
  })
  if (!isSilent) {
    ctx.io.stderr.write(
      `${openedLine(opened)} ${
        isNoWait
          ? `After approving, run: ${options.resumeCommand}`
          : 'Waiting for approval… (Ctrl-C to cancel)'
      }\n`
    )
  }
  const active: ActiveLogin = {
    sessionId: session.sessionId,
    pollSecret,
    privateKey: keyPair.privateKey,
    expiresAt: session.expiresAt,
    interval: session.interval,
    siteUrl,
  }
  const outcome = await waitOrForget(ctx, active, {
    waitMs: options.waitMs,
    restartCommand: options.restartCommand,
  })
  if (outcome.status === 'approved') {
    return { status: 'approved', approved: outcome.approved, apiUrl }
  }
  writePendingLogin(ctx.io.env, {
    v: 1,
    sessionId: session.sessionId,
    pollSecret,
    privateKey: await exportPrivateJwk(keyPair.privateKey),
    userCode: session.userCode,
    verificationUrl: session.verificationUrl,
    expiresAt: session.expiresAt,
    interval: outcome.interval,
    nextPollAt: outcome.nextPollAt,
    siteUrl,
    apiUrl,
    keys: options.keys,
  })
  return {
    status: 'pending',
    pending: pendingView(session, options.resumeCommand),
  }
}

/** Collects the sign-in `--no-wait` left pending. */
export async function resumeBrowserLogin(
  ctx: CliContext,
  options: Pick<
    BrowserLoginOptions,
    'waitMs' | 'resumeCommand' | 'restartCommand'
  >
): Promise<BrowserLoginResult> {
  const pending = readPendingLogin(ctx.io.env)
  const privateKey =
    pending === undefined ? undefined : await importKey(pending)
  if (pending === undefined || privateKey === undefined) {
    deletePendingLogin(ctx.io.env)
    throw new CliAuthError(
      'No browser sign-in is waiting to be resumed.',
      `Start one with \`${options.restartCommand} --no-wait --json\`, or run \`${options.restartCommand}\` and approve it in the browser.`,
      'CLI_LOGIN_NOT_PENDING'
    )
  }
  progress(
    ctx,
    `Checking the sign-in with code ${printable(pending.userCode)} (${printable(pending.verificationUrl)})…`
  )
  const outcome = await waitOrForget(
    ctx,
    {
      sessionId: pending.sessionId,
      pollSecret: pending.pollSecret,
      privateKey,
      expiresAt: pending.expiresAt,
      interval: pending.interval,
      siteUrl: pending.siteUrl,
    },
    {
      waitMs: options.waitMs,
      firstPollAt: pending.nextPollAt,
      restartCommand: options.restartCommand,
    }
  )
  if (outcome.status === 'pending') {
    // The next --resume keeps any slow_down or Retry-After this one got,
    // unless a newer sign-in has replaced this one meanwhile.
    if (readPendingLogin(ctx.io.env)?.sessionId === pending.sessionId) {
      writePendingLogin(ctx.io.env, {
        ...pending,
        interval: outcome.interval,
        nextPollAt: outcome.nextPollAt,
      })
    }
    return {
      status: 'pending',
      pending: pendingView(pending, options.resumeCommand),
    }
  }
  deletePendingLogin(ctx.io.env, pending.sessionId)
  return {
    status: 'approved',
    approved: outcome.approved,
    apiUrl: pending.apiUrl,
  }
}

/**
 * Polls; a sign-in that ended for good (denied, expired, unknown, or a seal
 * that would not open) takes its pending file with it.
 */
async function waitOrForget(
  ctx: CliContext,
  login: ActiveLogin,
  options: Parameters<typeof waitForApproval>[2]
): Promise<WaitOutcome> {
  try {
    return await waitForApproval(ctx, login, options)
  } catch (error) {
    if (
      (error instanceof CliAuthError && FINAL_LOGIN_CODES.has(error.code)) ||
      (error instanceof CliApiError && error.code === 'CLI_LOGIN_SEAL_INVALID')
    ) {
      deletePendingLogin(ctx.io.env, login.sessionId)
    }
    throw error
  }
}

async function importKey(
  pending: PendingLogin
): Promise<Awaited<ReturnType<typeof importPrivateJwk>> | undefined> {
  try {
    return await importPrivateJwk(pending.privateKey)
  } catch {
    return
  }
}

function pendingView(
  session: Pick<CreatedSession, 'verificationUrl' | 'userCode' | 'expiresAt'>,
  resumeCommand: string
): PendingLoginView {
  return {
    status: 'pending',
    verificationUrl: session.verificationUrl,
    userCode: session.userCode,
    expiresAt: session.expiresAt,
    resumeCommand,
  }
}

function instructionLines(session: CreatedSession): string[] {
  const url = printable(session.verificationUrl)
  return [
    `Sign in to Brew in your browser. The page is on ${new URL(session.verificationUrl).host}:`,
    `  ${url}`,
    `Check the code in your browser matches: ${printable(session.userCode)}`,
  ]
}

function openedLine(outcome: OpenOutcome): string {
  switch (outcome.status) {
    case 'opened':
      return 'Opened it in your browser.'
    case 'remote':
      return `This looks like ${outcome.remote.name}: open the link in a browser on any device.`
    case 'skipped':
      return 'Open the link in a browser on any device.'
    case 'failed':
      return 'Could not open a browser here: open the link in a browser on any device.'
  }
}
