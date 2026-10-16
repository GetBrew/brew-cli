import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type {
  AppEmailKitSet,
  AppEmailKitStackProvider,
  SetUpAppEmailKitResponse,
} from '@brew.new/sdk'
import { BrewApiError } from '@brew.new/sdk'
import { installOne, type McpInstallResult } from '../../commands/mcp/install'
import {
  buildContractsFile,
  fetchContractArtifacts,
  listAllTriggers,
} from '../../commands/types'
import { EMBEDDED_SKILLS } from '../../generated/skills'
import { CLI_VERSION } from '../../version'
import {
  type BrowserLoginResult,
  resumeBrowserLogin,
  startBrowserLogin,
} from '../auth-flow/login'
import type { ApprovedLogin } from '../auth-flow/poll'
import { siteUrlFromApiUrl } from '../auth-flow/session'
import {
  type BrewClient,
  buildSdkClient,
  maskApiKey,
  type ResolvedAuth,
  resolveAuth,
} from '../client'
import { readConfig, updateConfig } from '../config-store'
import { buildConfirmCommand } from '../confirm'
import { sdkTransportFor } from '../context'
import type { CommandOutcome } from '../define-command'
import { CliApiError, CliUsageError } from '../errors'
import { getInvocationPrefix } from '../invocation'
import { mcpUrlFromApiUrl, USER_SCOPE_ONLY } from '../mcp-clients'
import { progress } from '../output'
import { ensureEnvVars, getEnvValue, parseEnv } from '../project/env-file'
import { type PlannedChange, ProjectWriter } from '../project/fs-writer'
import { ensureIgnored } from '../project/gitignore'
import { addCommand, formatCommandLine } from '../project/package-manager'
import { resolveCwd, resolveHomeDir, resolveSpawn } from '../project/process'
import {
  BREW_STATE_FILE,
  type BrewManagedFile,
  type BrewProjectEmail,
  BrewStateError,
  createBrewState,
  readBrewState,
  serializeBrewState,
} from '../project/state'
import type { CliContext } from '../types'
import {
  type AuthId,
  detectProject,
  type ProjectDetection,
  rangeVersion,
} from './detect'
import {
  applyPatch,
  authjsPatch,
  betterAuthPatch,
  type ComputedPatch,
  type InitPatch,
  supabaseConfigPatch,
} from './patches'
import {
  exitCodeFor,
  INIT_REPORT_SCHEMA_VERSION,
  type InitEmail,
  type InitFile,
  type InitReport,
  type InitStep,
  type NextStep,
  overallStatus,
  renderReport,
} from './report'
import {
  APP_KEY_VARIABLE,
  agentsBlock,
  authHelperFile,
  authHelperPath,
  clientFile,
  clientPath,
  contractsPath,
  type GeneratedFile,
  SDK_PACKAGE,
  SDK_RANGE,
  SUPABASE_FUNCTION_PATH,
  SUPABASE_HOOK_SECRET_VARIABLE,
  skillInstallPath,
  supabaseHookFile,
  wantsAuthHelper,
} from './templates'

export type InitOptions = {
  readonly dryRun: boolean
  readonly app: string | undefined
  readonly domain: string | undefined
  readonly sets: readonly AppEmailKitSet[] | undefined
  readonly stack: AppEmailKitStackProvider | undefined
  readonly install: boolean
  readonly mcp: boolean
  readonly agentFiles: boolean
  readonly testEmail: boolean
  readonly testTo: string | undefined
  /** Patch id → hash prefix of the file it was reviewed against. */
  readonly applyPatches: ReadonlyMap<string, string>
  /** Shown on the approval page so the person picks the right brand. */
  readonly appUrl?: string | undefined
  readonly noWait: boolean
  readonly resume: boolean
  readonly openBrowser: boolean
}

/** The kit's auth stack for a detected auth library. */
export function kitStackFor(auth: AuthId): AppEmailKitStackProvider {
  switch (auth) {
    case 'better-auth':
    case 'authjs':
    case 'supabase':
    case 'clerk':
    case 'firebase':
      return auth
    default:
      return 'custom'
  }
}

const SANDBOX_NOTE =
  'Until a sending domain verifies, app emails reach members of your Brew organization only (team sandbox, daily cap).'

function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value
}

/** Never swallow a stop; 401 and 403 are the credential's, not a step's. */
function rethrowIfFatal(ctx: CliContext, error: unknown): void {
  ctx.signal.throwIfAborted()
  if (
    (error instanceof BrewApiError || error instanceof CliApiError) &&
    (error.status === 401 || error.status === 403)
  ) {
    throw error
  }
}

function describeError(error: unknown): string {
  if (error instanceof BrewApiError || error instanceof CliApiError) {
    return `${error.code}: ${error.message}`
  }
  return error instanceof Error ? error.message : String(error)
}

/** The command an agent re-runs to continue: same flags, `--yes`. */
/** Flags of `init` whose value is the next token (`--apply-patches a@b`). */
const VALUE_FLAGS: ReadonlySet<string> = new Set(['--apply-patches'])

function rerunCommand(
  ctx: CliContext,
  options: { readonly drop: readonly string[]; readonly add: readonly string[] }
): string {
  const argv: string[] = []
  for (let index = 0; index < ctx.rawArgv.length; index++) {
    const token = ctx.rawArgv[index] ?? ''
    const name = token.split('=')[0] ?? token
    if (token === '--yes' || options.drop.includes(name)) {
      // A dropped flag that takes a value drops its value too.
      if (VALUE_FLAGS.has(token)) {
        index++
      }
      continue
    }
    argv.push(token)
  }
  return buildConfirmCommand(
    [...argv, ...options.add],
    getInvocationPrefix(ctx.io.env)
  )
}

type Credential = {
  readonly auth: ResolvedAuth | undefined
  readonly source: InitReport['credential']['source']
}

export async function runInit(
  ctx: CliContext,
  options: InitOptions
): Promise<CommandOutcome> {
  const env = ctx.io.env
  const prefix = getInvocationPrefix(env)
  const spawn = resolveSpawn(ctx.io)
  const cwd = resolveCwd(ctx.io)
  const { dryRun } = options

  const detected = detectProject(cwd, {
    ...(options.app === undefined ? {} : { app: options.app }),
    env,
  })
  if (detected.kind === 'none') {
    throw new CliUsageError(
      `No app found in ${detected.root}: init needs a package.json (or supabase/functions). Run it in your app's directory${options.app === undefined ? ', or pass --app <dir>' : ''}.`
    )
  }
  if (detected.kind === 'ambiguous') {
    const report = ambiguousReport(detected, ctx, dryRun)
    return finish(report)
  }
  const project = detected.project
  progress(
    ctx,
    `Setting up Brew in ${project.root} (${project.framework}, auth: ${project.auth})…`
  )
  const writer = new ProjectWriter({ root: project.root, dryRun })
  let stateRead: ReturnType<typeof readBrewState>
  try {
    stateRead = readBrewState(project.root)
  } catch (error) {
    if (error instanceof BrewStateError) {
      throw new CliUsageError(
        `${error.message}. Fix or remove ${BREW_STATE_FILE}, then run init again.`
      )
    }
    throw error
  }
  const state = stateRead?.state ?? null
  const projectId = state?.projectId ?? randomUUID()
  // `init:<projectId>:<step>:<body hash>`: an identical re-run replays the
  // first request; a different body (another --stack, recipient or domain)
  // is a new request, never an idempotency conflict.
  const idempotencyKey = (step: string, body: unknown): string =>
    `init:${projectId}:${step}:${createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 12)}`
  const steps: InitStep[] = [
    {
      id: 'detect',
      status: 'done',
      detail: `${project.framework}${project.auth === 'none' ? '' : `, ${project.auth}`}, ${project.packageManager.name}`,
    },
  ]
  const nextSteps: NextStep[] = []
  const sets: readonly AppEmailKitSet[] = options.sets ?? ['auth', 'lifecycle']
  const lifecycle = sets.includes('lifecycle')
  const stack = options.stack ?? kitStackFor(project.auth)

  // ---- App key: .env.local must be git-ignored before a key goes in it.
  const envLocalText = writer.read('.env.local')
  const existingAppKey = nonEmpty(
    getEnvValue(parseEnv(envLocalText ?? ''), APP_KEY_VARIABLE)
  )
  const ignore = await ensureIgnored(writer, ['.env.local'], {
    spawn,
    signal: ctx.signal,
  })
  if (ignore.conflicts.length > 0) {
    steps.push({
      id: 'env',
      status: 'failed',
      detail:
        '.env.local is not git-ignored (a later rule re-includes it, or git already tracks it: `git rm --cached .env.local`); no key was written',
    })
    nextSteps.push({
      id: 'gitignore-env-local',
      actor: 'agent',
      kind: 'edit-file',
      path: '.gitignore',
      title:
        'Make git ignore .env.local (remove the rule that re-includes it), then run init again',
      blocking: true,
    })
    return finish(
      baseReport({
        ctx,
        project,
        projectId: state === null ? null : projectId,
        dryRun,
        steps,
        nextSteps,
        credential: { auth: undefined, source: 'none' },
        appKey: { status: 'missing', masked: null },
      })
    )
  }

  // ---- Credential: who this run acts as.
  const stored = readConfig(env)
  const apiUrl = resolveAuth({
    globals: ctx.globals,
    env,
    allowAnonymous: true,
  }).apiUrl
  const siteUrl = siteUrlFromApiUrl(apiUrl)
  const explicitKey =
    ctx.globals.apiKey ?? nonEmpty(env.BREW_API_KEY ?? undefined)
  const explicitBrand =
    ctx.globals.brand ?? nonEmpty(env.BREW_BRAND_ID) ?? state?.brandId
  let credential: Credential = { auth: undefined, source: 'none' }
  const authFor = (
    apiKey: string,
    source: Credential['source'],
    brandId: string | undefined
  ): Credential => ({
    auth: {
      apiKey,
      apiKeySource:
        source === 'flag' ? 'flag' : source === 'env' ? 'env' : 'config',
      brandId,
      apiUrl,
    },
    source,
  })
  if (explicitKey !== undefined) {
    credential = authFor(
      explicitKey,
      ctx.globals.apiKey === undefined ? 'env' : 'flag',
      explicitBrand
    )
  } else if (existingAppKey !== undefined) {
    credential = authFor(existingAppKey, 'env-file', state?.brandId)
  } else if (dryRun && stored.apiKey !== undefined) {
    credential = authFor(
      stored.apiKey,
      'config',
      state?.brandId ?? stored.brandId
    )
  }
  let appKey = existingAppKey
  let appKeyStatus: InitReport['credential']['appKey']['status'] =
    existingAppKey === undefined ? 'missing' : 'existing'
  let brand: InitReport['brand'] = null
  let signedInEmail: string | undefined = stored.userEmail

  if (existingAppKey !== undefined) {
    steps.push({
      id: 'sign-in',
      status: 'skipped',
      detail: `${APP_KEY_VARIABLE} already in .env.local`,
    })
  } else if (dryRun) {
    steps.push({
      id: 'sign-in',
      status: 'planned',
      detail:
        'browser sign-in: approve on brew.new, and an app key goes into .env.local',
    })
    appKeyStatus = 'planned'
  } else {
    const keys = (
      stored.apiKey === undefined && explicitKey === undefined
        ? ['cli', 'app']
        : ['app']
    ) as Array<'cli' | 'app'>
    const resumeCommand = rerunCommand(ctx, {
      drop: ['--no-wait', '--resume'],
      add: ['--resume'],
    })
    const loginCommands = {
      resumeCommand,
      restartCommand: rerunCommand(ctx, {
        drop: ['--no-wait', '--resume'],
        add: [],
      }),
    }
    const waitMs = options.noWait || !ctx.io.isTtyIn ? 0 : undefined
    const result: BrowserLoginResult = options.resume
      ? await resumeBrowserLogin(ctx, { waitMs, ...loginCommands })
      : await startBrowserLogin(ctx, {
          keys,
          client: {
            project: project.name.slice(0, 100),
            ...(options.appUrl === undefined ? {} : { appUrl: options.appUrl }),
          },
          openBrowser: options.openBrowser,
          waitMs,
          ...loginCommands,
        })
    if (result.status === 'pending') {
      steps.push({
        id: 'sign-in',
        status: 'pending',
        detail: `approve the sign-in (code ${result.pending.userCode})`,
      })
      nextSteps.push(
        {
          id: 'approve-sign-in',
          actor: 'human',
          kind: 'open-url',
          url: result.pending.verificationUrl,
          title: `Approve the Brew sign-in in a browser; check the code matches ${result.pending.userCode} (expires ${result.pending.expiresAt})`,
          blocking: true,
        },
        {
          id: 'resume-init',
          actor: 'agent',
          kind: 'run-command',
          command: result.pending.resumeCommand,
          title:
            'After approval, resume init (exit 3 again means not approved yet)',
          blocking: true,
        }
      )
      return finish(
        baseReport({
          ctx,
          project,
          projectId: state === null ? null : projectId,
          dryRun,
          steps,
          nextSteps,
          credential,
          appKey: { status: 'missing', masked: null },
        })
      )
    }
    const approved: ApprovedLogin = result.approved
    const minted = approved.keys.app
    if (minted === undefined) {
      throw new CliApiError({
        status: 200,
        code: 'CLI_LOGIN_SEAL_INVALID',
        type: 'internal_error',
        message: 'The approved sign-in carried no app key.',
        suggestion: `Run \`${loginCommands.restartCommand}\` again.`,
      })
    }
    appKey = minted.key
    brand = { brandId: approved.brand.brandId, name: approved.brand.name }
    signedInEmail = approved.approver.email
    const cliKey = approved.keys.cli
    if (cliKey !== undefined && keys.includes('cli')) {
      updateConfig(env, {
        apiKey: cliKey.key,
        brandId: approved.brand.brandId,
        userEmail: approved.approver.email,
        brandName: approved.brand.name,
      })
    }
    // The kit, contracts and test email must land in the brand the new app
    // key is bound to, so the rest of the run acts as that key, even when
    // an explicit key (maybe another brand's) started it.
    credential = authFor(minted.key, 'browser', approved.brand.brandId)
    steps.push({
      id: 'sign-in',
      status: 'done',
      detail: `signed in as ${approved.approver.email} to ${approved.brand.name}`,
    })
  }

  // ---- .env.local: the app key, 0600, never through a symbolic link.
  if (appKey !== undefined || envLocalText !== null) {
    const { text, results } = ensureEnvVars(
      envLocalText,
      appKey === undefined ? [] : [{ name: APP_KEY_VARIABLE, value: appKey }]
    )
    const change = writer.writeFile('.env.local', text, {
      overwrite: true,
      mode: 0o600,
      sensitive: true,
    })
    const result = results[0]
    if (change.action === 'refused') {
      steps.push({
        id: 'env',
        status: 'failed',
        detail: `.env.local not written: ${change.note ?? 'unsafe path'}`,
      })
    } else {
      if (
        appKeyStatus !== 'existing' &&
        (result?.action === 'added' || result?.action === 'filled')
      ) {
        appKeyStatus = 'written'
      }
      steps.push({
        id: 'env',
        status: dryRun ? 'planned' : 'done',
        detail:
          appKeyStatus === 'existing'
            ? `${APP_KEY_VARIABLE} kept`
            : `${APP_KEY_VARIABLE} ${dryRun ? 'will be added' : 'added'} (0600, git-ignored)`,
      })
    }
  } else {
    steps.push({
      id: 'env',
      status: 'planned',
      detail: `${APP_KEY_VARIABLE} goes into .env.local after sign-in`,
    })
  }

  const client: BrewClient | undefined =
    credential.auth === undefined
      ? undefined
      : buildSdkClient(credential.auth, sdkTransportFor(ctx))
  const afterSignIn = 'after sign-in'

  // ---- Brand.
  if (brand !== null) {
    steps.push({
      id: 'brand',
      status: 'done',
      detail: brand.name ?? brand.brandId,
    })
  } else if (client === undefined) {
    steps.push({
      id: 'brand',
      status: 'planned',
      detail: 'the brand you pick when signing in',
    })
  } else {
    try {
      const row = await client.brand.get()
      brand = {
        brandId: row.brandId,
        name: row.identity?.brandName ?? row.domain ?? null,
      }
      steps.push({
        id: 'brand',
        status: 'done',
        detail: brand.name ?? brand.brandId,
      })
    } catch (error) {
      rethrowIfFatal(ctx, error)
      steps.push({
        id: 'brand',
        status: 'failed',
        detail: describeError(error),
      })
    }
  }

  // ---- Domain: report it; add one when asked; never wait for DNS.
  const domain: {
    -readonly [K in keyof InitReport['domain']]: InitReport['domain'][K]
  } = {
    mode: 'unknown',
    domainId: null,
    name: null,
    status: null,
    added: false,
    records: [],
    settingsUrl: `${siteUrl}/domains`,
    sandbox: null,
  }
  if (client === undefined) {
    steps.push({ id: 'domain', status: 'planned', detail: afterSignIn })
  } else {
    try {
      const list = await client.domains.list({ limit: 100 })
      const verified = list.data.filter(
        (row) => row.status === 'verified' && row.sendable
      )
      const chosen =
        verified.find((row) => row.sendingPurpose === 'transactional') ??
        verified[0]
      let target =
        options.domain === undefined
          ? undefined
          : list.data.find(
              (row) => row.name.toLowerCase() === options.domain?.toLowerCase()
            )
      if (options.domain !== undefined && target === undefined) {
        if (dryRun) {
          domain.name = options.domain
        } else {
          const body = {
            name: options.domain,
            sendingPurpose: 'transactional' as const,
          }
          target = await client.domains.add(body, {
            idempotencyKey: idempotencyKey('domain', body),
          })
          domain.added = true
        }
      }
      const shown = target ?? chosen
      if (shown !== undefined) {
        domain.domainId = shown.domainId
        domain.name = shown.name
        domain.status = shown.status
        if (shown.status !== 'verified') {
          domain.records = shown.records.map((record) => ({
            type: record.type,
            name: record.name,
            value: record.value,
            ...(record.priority === undefined
              ? {}
              : { priority: record.priority }),
          }))
        }
      }
      domain.mode = chosen === undefined ? 'sandbox' : 'domain'
      if (chosen === undefined) {
        domain.sandbox = { note: SANDBOX_NOTE }
      }
      steps.push({
        id: 'domain',
        status:
          options.domain !== undefined && target === undefined && dryRun
            ? 'planned'
            : 'done',
        detail:
          chosen !== undefined
            ? `sending from ${chosen.name}`
            : domain.added
              ? `added ${domain.name}; sandbox until its DNS verifies`
              : 'sandbox (no verified domain yet)',
      })
      if (domain.records.length > 0 && domain.domainId !== null) {
        nextSteps.push({
          id: 'add-dns-records',
          actor: 'human',
          kind: 'add-dns-records',
          title: `Add the DNS records for ${domain.name} at your DNS provider, then verify`,
          command: `${prefix} domains verify ${domain.domainId}`,
          url: shown?.domainUrl ?? domain.settingsUrl,
          blocking: false,
        })
      } else if (chosen === undefined) {
        nextSteps.push({
          id: 'verify-domain',
          actor: 'human',
          kind: 'open-url',
          url: domain.settingsUrl,
          title:
            'Add and verify a sending domain so app emails reach every user (the sandbox reaches your team only)',
          blocking: false,
        })
      }
    } catch (error) {
      rethrowIfFatal(ctx, error)
      steps.push({
        id: 'domain',
        status: 'failed',
        detail: describeError(error),
      })
    }
  }

  // ---- The starter kit.
  let kit: SetUpAppEmailKitResponse | undefined
  const emails: InitEmail[] = []
  if (client === undefined || dryRun) {
    steps.push({
      id: 'kit',
      status: 'planned',
      detail: `${sets.join(' + ')} kit for ${stack}${client === undefined ? `, ${afterSignIn}` : ''}`,
    })
  } else {
    try {
      progress(
        ctx,
        `Setting up the ${sets.join(' + ')} app emails for ${stack}…`
      )
      const body = { sets: [...sets], stack }
      kit = await client.appEmails.setUpKit(body, {
        idempotencyKey: idempotencyKey('kit', body),
      })
      for (const entry of kit.results) {
        emails.push(
          entry.ok
            ? {
                key: entry.triggerKey,
                ok: true,
                triggerEventId: entry.triggerEventId,
                automationId: entry.automationId,
                published: entry.published,
                sender: entry.sender.mode,
                created:
                  entry.created.trigger ||
                  entry.created.email ||
                  entry.created.automation,
              }
            : {
                key: entry.triggerKey,
                ok: false,
                error: { code: entry.error.code, message: entry.error.message },
              }
        )
      }
      const failed = emails.filter((email) => !email.ok)
      steps.push({
        id: 'kit',
        status: failed.length > 0 ? 'failed' : 'done',
        detail:
          failed.length > 0
            ? `${failed.length} of ${emails.length} keys failed: ${failed.map((email) => email.key).join(', ')}`
            : `${emails.length} app emails published`,
      })
      if (failed.length > 0) {
        nextSteps.push({
          id: 'rerun-init',
          actor: 'agent',
          kind: 'run-command',
          command: rerunCommand(ctx, {
            drop: ['--resume', '--no-wait'],
            add: [],
          }),
          title: 'Run init again to finish the keys that failed',
          blocking: true,
        })
      }
    } catch (error) {
      rethrowIfFatal(ctx, error)
      steps.push({ id: 'kit', status: 'failed', detail: describeError(error) })
    }
  }

  // ---- Install the SDK with the project's package manager.
  const install = planInstall({ project, options, steps, nextSteps })
  if (install !== undefined) {
    await runInstall(ctx, install, { steps, nextSteps, spawn })
  }

  // ---- Managed files.
  const files: InitFile[] = []
  if (ignore.change !== undefined && ignore.change.action !== 'unchanged') {
    files.push({
      path: '.gitignore',
      action: ignore.change.action,
      role: 'gitignore',
      note: 'ignores .env.local',
    })
  }
  const managed: Array<{
    readonly file: GeneratedFile
    readonly change: PlannedChange
  }> = []
  const writeManaged = (file: GeneratedFile): PlannedChange => {
    const recorded = state?.files[file.path]?.sha256
    const change = writer.writeFile(
      file.path,
      file.content,
      recorded === undefined ? {} : { managedSha256: recorded }
    )
    managed.push({ file, change })
    files.push({
      path: file.path,
      action: change.action,
      role: file.role,
      ...(change.note === undefined ? {} : { note: change.note }),
    })
    return change
  }
  const installsSkills = project.editors.includes('claude-code')
  const paths = {
    client: clientPath(project),
    auth: wantsAuthHelper(project, { lifecycle })
      ? authHelperPath(project)
      : null,
    contracts: contractsPath(project),
  }
  try {
    if (paths.client !== null) {
      writeManaged({
        path: paths.client,
        content: clientFile(project),
        role: 'client',
      })
    }
    if (paths.auth !== null) {
      writeManaged({
        path: paths.auth,
        content: authHelperFile(project, { lifecycle }),
        role: 'auth',
      })
    }
    if (project.auth === 'supabase') {
      writeManaged({
        path: SUPABASE_FUNCTION_PATH,
        content: supabaseHookFile(),
        role: 'supabase-hook',
      })
    }
    if (paths.contracts !== null) {
      if (client === undefined) {
        files.push({
          path: paths.contracts,
          action: 'planned',
          role: 'contracts',
          note: afterSignIn,
        })
      } else {
        const triggers = await listAllTriggers(client)
        const artifacts = await fetchContractArtifacts(client, triggers)
        writeManaged({
          path: paths.contracts,
          content: buildContractsFile({ artifacts }),
          role: 'contracts',
        })
      }
    }
    // Skills go where Claude Code reads them, and only into a project that
    // already uses it: creating `.claude/` would make the next run detect
    // an editor nobody uses.
    if (options.agentFiles && installsSkills) {
      for (const skill of EMBEDDED_SKILLS) {
        writeManaged({
          path: skillInstallPath(skill.name),
          content: skill.content,
          role: 'skill',
        })
      }
    }
    const exampleText = writer.read('.env.example')
    const example = ensureEnvVars(exampleText, [
      { name: APP_KEY_VARIABLE, value: '', secret: false },
      ...(project.auth === 'supabase'
        ? [{ name: SUPABASE_HOOK_SECRET_VARIABLE, value: '', secret: false }]
        : []),
    ])
    const exampleChange = writer.writeFile('.env.example', example.text, {
      overwrite: true,
    })
    files.push({
      path: '.env.example',
      action: exampleChange.action,
      role: 'env-example',
    })
    const kept = files.filter((file) => file.action === 'kept-user-version')
    steps.push({
      id: 'files',
      status: dryRun ? 'planned' : 'done',
      detail:
        kept.length > 0
          ? `kept your version of ${kept.map((file) => file.path).join(', ')}`
          : `${files.filter((file) => file.action === 'created' || file.action === 'updated').length} ${dryRun ? 'to write' : 'written'}`,
    })
  } catch (error) {
    rethrowIfFatal(ctx, error)
    steps.push({ id: 'files', status: 'failed', detail: describeError(error) })
  }

  // ---- Patches to the user's own config: printed, applied on request.
  const computedPatches: ComputedPatch[] = []
  if (paths.auth !== null && project.auth === 'better-auth') {
    computedPatches.push(betterAuthPatch(project, paths.auth, { lifecycle }))
  }
  if (paths.auth !== null && project.auth === 'authjs') {
    computedPatches.push(authjsPatch(project, paths.auth))
  }
  if (project.auth === 'supabase' && project.hasSupabaseDir) {
    computedPatches.push(supabaseConfigPatch(project))
  }
  const patches: InitPatch[] = computedPatches.map((computed) => {
    const pin = options.applyPatches.get(computed.patch.id)
    if (pin === undefined || computed.patch.status !== 'pending') {
      return computed.patch
    }
    // Applied only when the file still hashes to what was reviewed: a file
    // edited since the report would get a diff nobody saw.
    return computed.patch.baseSha256?.startsWith(pin) === true
      ? applyPatch(writer, computed)
      : { ...computed.patch, status: 'stale' }
  })
  for (const patch of patches) {
    if (patch.status === 'pending' || patch.status === 'stale') {
      nextSteps.push({
        id: `apply-${patch.id}`,
        actor: 'agent',
        kind: 'apply-patch',
        patchId: patch.id,
        path: patch.path,
        title: `${patch.title} (review the diff, then apply)`,
        command: rerunCommand(ctx, {
          drop: ['--resume', '--no-wait', '--dry-run', '--apply-patches'],
          add: [
            '--apply-patches',
            `${patch.id}@${(patch.baseSha256 ?? '').slice(0, 12)}`,
          ],
        }),
        blocking: true,
      })
    } else if (patch.status === 'manual') {
      nextSteps.push({
        id: `edit-${patch.id}`,
        actor: 'agent',
        kind: 'edit-file',
        patchId: patch.id,
        path: patch.path,
        title: `${patch.title}: add the snippet by hand`,
        blocking: true,
      })
    }
  }
  steps.push({
    id: 'patches',
    status: patches.length === 0 ? 'skipped' : dryRun ? 'planned' : 'done',
    detail:
      patches.length === 0
        ? 'nothing to patch'
        : patches.map((patch) => `${patch.id} ${patch.status}`).join(', '),
  })

  // ---- MCP clients the project already uses.
  const mcp: McpInstallResult[] = []
  if (!options.mcp) {
    steps.push({ id: 'mcp', status: 'skipped', detail: '--no-mcp' })
  } else if (project.editors.length === 0) {
    steps.push({
      id: 'mcp',
      status: 'skipped',
      detail: 'no editor config found',
    })
    nextSteps.push({
      id: 'mcp-install',
      actor: 'agent',
      kind: 'run-command',
      command: `${prefix} mcp install --client <cursor|vscode|claude-code|gemini>`,
      title: 'Connect your AI editor to the Brew MCP server',
      blocking: false,
    })
  } else {
    const mcpRoot = project.monorepo?.root ?? project.root
    const mcpWriter = new ProjectWriter({ root: mcpRoot, dryRun })
    for (const editor of project.editors) {
      mcp.push(
        installOne({
          client: editor,
          scope: 'project',
          auth: 'oauth',
          mcpUrl: mcpUrlFromApiUrl(apiUrl),
          projectRoot: mcpRoot,
          home: resolveHomeDir(env),
          env,
          writer: mcpWriter,
          mode: USER_SCOPE_ONLY.has(editor) ? 'report' : 'write',
        })
      )
    }
    steps.push({
      id: 'mcp',
      status: dryRun ? 'planned' : 'done',
      detail: mcp.map((entry) => `${entry.client} ${entry.action}`).join(', '),
    })
  }

  // ---- AGENTS.md block.
  const keys = [
    ...new Set([
      ...emails.filter((email) => email.ok).map((email) => email.key),
      ...Object.keys(state?.emails ?? {}),
    ]),
  ].sort()
  if (options.agentFiles) {
    const change = writer.upsertBlock(
      'AGENTS.md',
      agentsBlock({
        project,
        keys,
        files: paths,
        skillPaths: installsSkills
          ? EMBEDDED_SKILLS.map((skill) => skillInstallPath(skill.name))
          : [],
      })
    )
    files.push({
      path: 'AGENTS.md',
      action: change.action,
      role: 'agents-block',
      ...(change.note === undefined ? {} : { note: change.note }),
    })
    steps.push({
      id: 'agent-files',
      status: dryRun ? 'planned' : 'done',
      detail: installsSkills
        ? `AGENTS.md block and ${EMBEDDED_SKILLS.length} skills in .claude/skills`
        : 'AGENTS.md block (skills only go into a Claude Code project)',
    })
  } else {
    steps.push({
      id: 'agent-files',
      status: 'skipped',
      detail: '--no-agent-files',
    })
  }

  // ---- brew.json: ids and hashes, so re-runs converge.
  const stateEmails: Record<string, BrewProjectEmail> = {
    ...(state?.emails ?? {}),
  }
  for (const email of emails) {
    if (
      email.ok &&
      email.triggerEventId !== undefined &&
      email.automationId !== undefined
    ) {
      stateEmails[email.key] = {
        triggerEventId: email.triggerEventId,
        automationId: email.automationId,
      }
    }
  }
  const stateFiles: Record<string, BrewManagedFile> = {
    ...(state?.files ?? {}),
  }
  for (const { file, change } of managed) {
    const previous = state?.files[file.path]
    if (
      (change.action === 'created' ||
        change.action === 'updated' ||
        change.action === 'unchanged') &&
      change.sha256 !== undefined
    ) {
      stateFiles[file.path] =
        change.action === 'unchanged' && previous?.sha256 === change.sha256
          ? previous
          : {
              sha256: change.sha256,
              generator: `init@${CLI_VERSION}:${file.path}`,
            }
    }
  }
  const mcpIds = [
    ...new Set([
      ...(state?.mcp ?? []),
      ...mcp
        .filter((entry) =>
          ['created', 'updated', 'unchanged'].includes(entry.action)
        )
        .map((entry) => entry.client),
    ]),
  ]
  const brandId = brand?.brandId ?? state?.brandId
  const nextState = createBrewState({
    ...(state ?? {}),
    projectId,
    ...(brandId === undefined ? {} : { brandId }),
    framework: project.framework,
    auth:
      project.authVersion === null
        ? project.auth
        : `${project.auth}-${project.authVersion}`,
    ...(paths.contracts === null ? {} : { contractsPath: paths.contracts }),
    emails: stateEmails,
    files: stateFiles,
    ...(mcpIds.length === 0 ? {} : { mcp: mcpIds }),
  })
  const stateChange = writer.writeFile(
    BREW_STATE_FILE,
    serializeBrewState(nextState, stateRead?.extra ?? {}),
    { overwrite: true }
  )
  files.push({
    path: BREW_STATE_FILE,
    action: stateChange.action,
    role: 'state',
  })
  steps.push({ id: 'state', status: dryRun ? 'planned' : 'done' })

  // ---- Project next steps that do not depend on a step's outcome.
  projectNextSteps({ project, nextSteps, siteUrl, paths, prefix })

  // ---- A sandbox test email to the person who signed in.
  const testEmail = await sendTestEmail({
    ctx,
    client,
    options,
    emails,
    to: options.testTo ?? signedInEmail,
    idempotencyKey: (body) => idempotencyKey('test-email', body),
    steps,
    nextSteps,
    prefix,
  })

  const report = baseReport({
    ctx,
    project,
    // A dry run mints no project id: the one it would use is not kept.
    projectId: dryRun ? (state?.projectId ?? null) : projectId,
    dryRun,
    steps,
    nextSteps,
    credential,
    appKey: {
      status: appKeyStatus,
      masked: appKey === undefined ? null : maskApiKey(appKey),
    },
    brand,
    domain,
    stack:
      kit === undefined
        ? { provider: stack, authDelivery: null, note: null }
        : {
            provider: kit.stack.provider,
            authDelivery: kit.stack.authDelivery,
            note: kit.stack.note,
          },
    emails,
    files,
    patches,
    mcp,
    testEmail,
    paths,
    keys,
  })
  return finish(report)
}

type InstallPlan = {
  readonly line: ReturnType<typeof addCommand>
  readonly cwd: string
  readonly command: string
}

/**
 * The `add @brew.new/sdk` command for this project, or undefined when there
 * is nothing to run now (already declared, opted out, a dry run, or a
 * runtime that does not install from npm); those cases record their step.
 */
function planInstall(input: {
  readonly project: ProjectDetection
  readonly options: InitOptions
  readonly steps: InitStep[]
  readonly nextSteps: NextStep[]
}): InstallPlan | undefined {
  const { project, options, steps, nextSteps } = input
  if (
    !project.hasPackageJson ||
    project.runtime === 'deno' ||
    project.runtime === 'browser'
  ) {
    steps.push({
      id: 'install',
      status: 'skipped',
      detail:
        project.runtime === 'browser'
          ? 'browser-only app: send from your server or Supabase Edge Functions'
          : `Edge Functions import npm:${SDK_PACKAGE}@${SDK_RANGE}`,
    })
    return
  }
  const version = rangeVersion(project.sdkRange ?? undefined)
  if (
    version !== null &&
    (version[0] > 12 || (version[0] === 12 && version[1] >= 3))
  ) {
    steps.push({
      id: 'install',
      status: 'skipped',
      detail: `${SDK_PACKAGE} ${project.sdkRange} already declared`,
    })
    return
  }
  const workspace =
    project.monorepo !== null &&
    project.monorepo.workspace !== null &&
    project.monorepo.workspaceName !== null
      ? {
          name: project.monorepo.workspaceName,
          dir: project.monorepo.workspace,
        }
      : undefined
  const line = addCommand(
    project.packageManager,
    [`${SDK_PACKAGE}@${SDK_RANGE}`],
    workspace === undefined ? {} : { workspace }
  )
  const base = project.monorepo?.root ?? project.root
  const command = formatCommandLine(line)
  if (!options.install) {
    steps.push({ id: 'install', status: 'skipped', detail: '--no-install' })
    nextSteps.push({
      id: 'install-sdk',
      actor: 'agent',
      kind: 'run-command',
      command,
      title: `Install ${SDK_PACKAGE} (the generated files import it)`,
      blocking: true,
    })
    return
  }
  if (options.dryRun) {
    steps.push({ id: 'install', status: 'planned', detail: command })
    return
  }
  return { line, cwd: join(base, line.cwd ?? ''), command }
}

async function runInstall(
  ctx: CliContext,
  install: InstallPlan,
  sink: {
    readonly steps: InitStep[]
    readonly nextSteps: NextStep[]
    readonly spawn: ReturnType<typeof resolveSpawn>
  }
): Promise<void> {
  progress(ctx, `Installing: ${install.command}`)
  let failure: string | undefined
  try {
    const result = await sink.spawn(install.line.command, install.line.args, {
      cwd: install.cwd,
      signal: ctx.signal,
    })
    if (result.code !== 0) {
      failure = `${install.line.command} exited ${result.code ?? 'by a signal'}`
    }
  } catch (error) {
    ctx.signal.throwIfAborted()
    failure = `${install.line.command} could not start (${error instanceof Error ? error.message : String(error)})`
  }
  if (failure === undefined) {
    sink.steps.push({ id: 'install', status: 'done', detail: install.command })
    return
  }
  sink.steps.push({ id: 'install', status: 'failed', detail: failure })
  sink.nextSteps.push({
    id: 'install-sdk',
    actor: 'agent',
    kind: 'run-command',
    command: install.command,
    title: `Install ${SDK_PACKAGE} (the generated files import it)`,
    blocking: true,
  })
}

function projectNextSteps(input: {
  readonly project: ProjectDetection
  readonly nextSteps: NextStep[]
  readonly siteUrl: string
  readonly paths: { readonly client: string | null }
  readonly prefix: string
}): void {
  const { project, nextSteps } = input
  if (project.auth === 'supabase') {
    nextSteps.push(
      {
        id: 'deploy-supabase-hook',
        actor: 'agent',
        kind: 'run-command',
        command: 'supabase functions deploy send-email --no-verify-jwt',
        title: 'Deploy the Send Email Hook function',
        blocking: true,
      },
      {
        id: 'connect-supabase-hook',
        actor: 'human',
        kind: 'open-url',
        url: 'https://supabase.com/dashboard/project/_/auth/hooks',
        title:
          "In Supabase, set Authentication > Hooks > Send Email to the send-email function's URL; store the secret it shows as SEND_EMAIL_HOOK_SECRET and BREW_API_KEY (from .env.local) in the Edge Function secrets",
        blocking: true,
      }
    )
  }
  if (project.auth === 'clerk') {
    nextSteps.push({
      id: 'connect-clerk',
      actor: 'human',
      kind: 'open-url',
      url: `${input.siteUrl}/integrations/clerk`,
      title:
        'Clerk keeps sending its own auth emails. Connect Clerk in Brew to start lifecycle automations from Clerk events (or call sendWelcomeEmail from your webhook)',
      blocking: false,
    })
  }
  if (project.runtime === 'workers') {
    nextSteps.push({
      id: 'worker-secret',
      actor: 'human',
      kind: 'set-secret',
      command: 'wrangler secret put BREW_API_KEY',
      title:
        'Store BREW_API_KEY as a Worker secret (and in .dev.vars for wrangler dev); the value is in .env.local',
      blocking: true,
    })
  }
  if (project.runtime === 'browser' && project.auth !== 'supabase') {
    nextSteps.push({
      id: 'server-needed',
      actor: 'agent',
      kind: 'review',
      title:
        'This app runs only in the browser: send Brew email from a server (an API route, Supabase Edge Functions), never with the key in client code',
      blocking: true,
    })
  }
  if (
    input.paths.client !== null &&
    project.runtime === 'node' &&
    (project.framework === 'express' ||
      project.framework === 'hono' ||
      project.framework === 'node')
  ) {
    nextSteps.push({
      id: 'load-env-local',
      actor: 'agent',
      kind: 'review',
      title:
        'This server does not read .env.local by itself: start it with `node --env-file=.env.local …` (Node 20.6+) or load the file with dotenv before getBrew() runs',
      blocking: true,
    })
  }
  if (input.paths.client !== null && project.runtime === 'node') {
    nextSteps.push({
      id: 'production-env',
      actor: 'human',
      kind: 'set-secret',
      title:
        "Add BREW_API_KEY to your hosting provider's environment (Vercel, Netlify, Railway, …); the value is in .env.local",
      blocking: false,
    })
  }
}

async function sendTestEmail(input: {
  readonly ctx: CliContext
  readonly client: BrewClient | undefined
  readonly options: InitOptions
  readonly emails: readonly InitEmail[]
  readonly to: string | undefined
  readonly idempotencyKey: (body: unknown) => string
  readonly steps: InitStep[]
  readonly nextSteps: NextStep[]
  readonly prefix: string
}): Promise<InitReport['testEmail']> {
  const { ctx, client, options, steps } = input
  const ready = input.emails.filter(
    (email) => email.ok && email.published !== false
  )
  const key =
    ready.find((email) => email.key === 'lifecycle.welcome')?.key ??
    ready.find((email) => email.key === 'auth.verify-email')?.key ??
    null
  const to = input.to ?? null
  if (!options.testEmail) {
    steps.push({
      id: 'test-email',
      status: 'skipped',
      detail: '--no-test-email',
    })
    return { status: 'skipped', key: null, to: null, reason: '--no-test-email' }
  }
  if (options.dryRun || client === undefined) {
    // The key the real run picks: the welcome email, else the verify email.
    const sets = options.sets ?? ['auth', 'lifecycle']
    const planned = sets.includes('lifecycle')
      ? 'lifecycle.welcome'
      : 'auth.verify-email'
    steps.push({
      id: 'test-email',
      status: 'planned',
      detail: `${planned} to ${to ?? 'the person who signs in'}`,
    })
    return { status: 'planned', key: planned, to }
  }
  if (key === null) {
    steps.push({
      id: 'test-email',
      status: 'skipped',
      detail: 'no published app email to send',
    })
    return {
      status: 'skipped',
      key: null,
      to,
      reason: 'no published app email',
    }
  }
  if (to === null) {
    steps.push({
      id: 'test-email',
      status: 'skipped',
      detail: 'no recipient: pass --test-to',
    })
    input.nextSteps.push({
      id: 'send-test-email',
      actor: 'agent',
      kind: 'run-command',
      command: `${input.prefix} send ${key} --to <you@example.com> --yes`,
      title:
        'Send yourself a test email (a member of your Brew organization while in the sandbox)',
      blocking: false,
    })
    return { status: 'skipped', key, to: null, reason: 'no recipient' }
  }
  try {
    progress(ctx, `Sending a test email (${key}) to ${to}…`)
    const payload = { email: to }
    const result = await client.send(key, payload, {
      idempotencyKey: input.idempotencyKey({ key, payload }),
    })
    const blocked = result.notStarted?.find(
      (entry) => entry.code === 'DOMAIN_REQUIRED'
    )
    if (blocked !== undefined || (result.automationRunIds?.length ?? 0) === 0) {
      const reason =
        blocked !== undefined
          ? `${to} is not a member of your Brew organization: the sandbox sends to your team only until a domain verifies`
          : 'no published automation started'
      steps.push({ id: 'test-email', status: 'skipped', detail: reason })
      return {
        status: 'skipped',
        key,
        to,
        triggerInstanceId: result.triggerInstanceId,
        reason,
      }
    }
    steps.push({ id: 'test-email', status: 'done', detail: `${key} to ${to}` })
    return {
      status: result.status === 'replayed' ? 'replayed' : 'sent',
      key,
      to,
      triggerInstanceId: result.triggerInstanceId,
    }
  } catch (error) {
    rethrowIfFatal(ctx, error)
    // The setup itself is done; a test email that did not go out (say
    // 429 SANDBOX_DAILY_LIMIT) is a retry for later, not a failed init.
    steps.push({
      id: 'test-email',
      status: 'skipped',
      detail: `not sent: ${describeError(error)}`,
    })
    input.nextSteps.push({
      id: 'send-test-email',
      actor: 'agent',
      kind: 'run-command',
      command: `${input.prefix} send ${key} --to ${to} --yes`,
      title: 'Send the test email again later',
      blocking: false,
    })
    return { status: 'failed', key, to, reason: describeError(error) }
  }
}

function agentInstructions(input: {
  readonly status: InitReport['status']
  readonly paths: {
    readonly client: string | null
    readonly auth: string | null
    readonly contracts: string | null
  }
  readonly keys: readonly string[]
  readonly nextSteps: readonly NextStep[]
}): string {
  const parts: string[] = []
  if (input.status === 'auth_required') {
    return 'Show the person the verificationUrl and code from nextSteps, ask them to approve on brew.new only if the code matches, then run the resume-init command. Never ask for or print an API key.'
  }
  if (input.status === 'ambiguous_project') {
    return 'This is a monorepo with several apps. Ask which app sends the email (or pick the web app), then run the matching init command from nextSteps.'
  }
  if (input.paths.client !== null) {
    parts.push(
      `Send app email from server code with getBrew().send(key, payload) from ${input.paths.client}${input.paths.auth === null ? '' : `; auth and welcome helpers are in ${input.paths.auth}`}.`
    )
  }
  if (input.paths.contracts !== null) {
    parts.push(
      `Payload types and the key registry are in ${input.paths.contracts}.`
    )
  }
  if (input.keys.length > 0) {
    parts.push(`Keys: ${input.keys.join(', ')}.`)
  }
  parts.push(
    'BREW_API_KEY lives in .env.local: never print it, commit it, or give it a NEXT_PUBLIC_/VITE_/PUBLIC_ name.'
  )
  const blocking = input.nextSteps.filter((step) => step.blocking)
  if (blocking.length > 0) {
    parts.push(
      `Do the blocking nextSteps in order (${blocking.map((step) => step.id).join(', ')}); hand the human ones to the person.`
    )
  }
  return parts.join(' ')
}

function baseReport(input: {
  readonly ctx: CliContext
  readonly project: ProjectDetection
  readonly projectId: string | null
  readonly dryRun: boolean
  readonly steps: readonly InitStep[]
  readonly nextSteps: readonly NextStep[]
  readonly credential: Credential
  readonly appKey: {
    readonly status: InitReport['credential']['appKey']['status']
    readonly masked: string | null
  }
  readonly brand?: InitReport['brand']
  readonly domain?: InitReport['domain']
  readonly stack?: InitReport['stack']
  readonly emails?: readonly InitEmail[]
  readonly files?: readonly InitFile[]
  readonly patches?: readonly InitPatch[]
  readonly mcp?: readonly McpInstallResult[]
  readonly testEmail?: InitReport['testEmail']
  readonly paths?: {
    readonly client: string | null
    readonly auth: string | null
    readonly contracts: string | null
  }
  readonly keys?: readonly string[]
}): InitReport {
  const { project } = input
  const status = overallStatus({
    dryRun: input.dryRun,
    steps: input.steps,
    nextSteps: input.nextSteps,
  })
  const siteUrl = siteUrlFromApiUrl(
    resolveAuth({
      globals: input.ctx.globals,
      env: input.ctx.io.env,
      allowAnonymous: true,
    }).apiUrl
  )
  return {
    schemaVersion: INIT_REPORT_SCHEMA_VERSION,
    status,
    dryRun: input.dryRun,
    project: {
      root: project.root,
      name: project.name,
      projectId: input.projectId,
      packageManager: project.packageManager.name,
      monorepo:
        project.monorepo === null
          ? null
          : {
              tool: project.monorepo.tool,
              root: project.monorepo.root,
              workspace: project.monorepo.workspace,
            },
      framework: project.framework,
      runtime: project.runtime,
      auth: project.auth,
      authVersion: project.authVersion,
      authDetected: project.authDetected,
      billing: project.billing,
      existingEmail: project.existingEmail,
      builder: project.builder,
      typescript: project.typescript,
      editors: project.editors,
      remote: project.remote,
    },
    brand: input.brand ?? null,
    credential: {
      source: input.credential.source,
      apiKey:
        input.credential.auth === undefined
          ? null
          : maskApiKey(input.credential.auth.apiKey),
      appKey: {
        variable: APP_KEY_VARIABLE,
        file: '.env.local',
        status: input.appKey.status,
        masked: input.appKey.masked,
      },
    },
    domain: input.domain ?? {
      mode: 'unknown',
      domainId: null,
      name: null,
      status: null,
      added: false,
      records: [],
      settingsUrl: `${siteUrl}/domains`,
      sandbox: null,
    },
    stack: input.stack ?? null,
    emails: input.emails ?? [],
    files: input.files ?? [],
    patches: input.patches ?? [],
    mcp: input.mcp ?? [],
    testEmail: input.testEmail ?? { status: 'skipped', key: null, to: null },
    steps: input.steps,
    nextSteps: input.nextSteps,
    agentInstructions: agentInstructions({
      status,
      paths: input.paths ?? { client: null, auth: null, contracts: null },
      keys: input.keys ?? [],
      nextSteps: input.nextSteps,
    }),
  }
}

function ambiguousReport(
  detected: Extract<ReturnType<typeof detectProject>, { kind: 'ambiguous' }>,
  ctx: CliContext,
  dryRun: boolean
): InitReport {
  const nextSteps: NextStep[] = detected.candidates.map((candidate) => ({
    id: `init-${candidate.dir.replaceAll('/', '-')}`,
    actor: 'agent',
    kind: 'run-command',
    command: rerunCommand(ctx, {
      drop: ['--resume', '--no-wait'],
      add: ['--app', candidate.dir],
    }),
    title: `Set up ${candidate.name} (${candidate.framework})`,
    blocking: true,
  }))
  const siteUrl = siteUrlFromApiUrl(
    resolveAuth({ globals: ctx.globals, env: ctx.io.env, allowAnonymous: true })
      .apiUrl
  )
  return {
    schemaVersion: INIT_REPORT_SCHEMA_VERSION,
    status: 'ambiguous_project',
    dryRun,
    project: {
      root: detected.root,
      name: detected.root.split(/[\\/]/).at(-1) ?? detected.root,
      projectId: null,
      packageManager: null,
      monorepo: {
        tool: detected.monorepo.tool,
        root: detected.monorepo.root,
        workspace: null,
      },
      candidates: detected.candidates.map((candidate) => ({
        name: candidate.name,
        dir: candidate.dir,
        framework: candidate.framework,
      })),
      framework: null,
      runtime: null,
      auth: null,
      authVersion: null,
      authDetected: [],
      billing: [],
      existingEmail: [],
      builder: null,
      typescript: false,
      editors: [],
      remote: null,
    },
    brand: null,
    credential: {
      source: 'none',
      apiKey: null,
      appKey: {
        variable: APP_KEY_VARIABLE,
        file: '.env.local',
        status: 'missing',
        masked: null,
      },
    },
    domain: {
      mode: 'unknown',
      domainId: null,
      name: null,
      status: null,
      added: false,
      records: [],
      settingsUrl: `${siteUrl}/domains`,
      sandbox: null,
    },
    stack: null,
    emails: [],
    files: [],
    patches: [],
    mcp: [],
    testEmail: { status: 'skipped', key: null, to: null },
    steps: [
      {
        id: 'detect',
        status: 'failed',
        detail: `${detected.candidates.length} apps in this monorepo: pick one with --app`,
      },
    ],
    nextSteps,
    agentInstructions: agentInstructions({
      status: 'ambiguous_project',
      paths: { client: null, auth: null, contracts: null },
      keys: [],
      nextSteps,
    }),
  }
}

function finish(report: InitReport): CommandOutcome {
  const exitCode = exitCodeFor(report.status)
  return {
    data: report,
    human: renderReport(report),
    ...(exitCode === 0 ? {} : { exitCode }),
  }
}
