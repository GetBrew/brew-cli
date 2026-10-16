import { join } from 'node:path'
import { unifiedDiff } from '../project/diff'
import {
  normalizeEol,
  type ProjectWriter,
  readTextFile,
  sha256Hex,
} from '../project/fs-writer'
import { findAuthConfig, type ProjectDetection } from './detect'
import {
  importSuffix,
  relativeImport,
  SUPABASE_CONFIG_BLOCK,
} from './templates'

/**
 * Edits to files the user owns (their auth config, `supabase/config.toml`).
 * Init never writes these on its own: each is reported as a patch with a
 * diff, and `--apply-patches` applies one only when the file still hashes
 * to what the patch was computed from. A patch that would replace something
 * the user wrote (an existing email sender) is never computed: it comes
 * back `manual` with the snippet to add by hand.
 */

export type PatchStatus =
  /** Computed, not applied (no `--apply-patches`, or a dry run). */
  | 'pending'
  | 'applied'
  /** The file already has it. */
  | 'already-applied'
  /** Init cannot place it safely: add `snippet` by hand. */
  | 'manual'
  /** The file changed after the patch was computed: not applied. */
  | 'stale'

export type InitPatch = {
  readonly id: string
  /** Root-relative path of the file the patch edits. */
  readonly path: string
  readonly title: string
  readonly description: string
  readonly status: PatchStatus
  /** sha256 of the file the patch was computed against (LF-normalized). */
  readonly baseSha256?: string
  /** The change as a unified diff (`pending`, `applied`, `stale`). */
  readonly diff?: string
  /** What to add by hand (`manual`). */
  readonly snippet?: string
}

/** A patch plus the content it would write (never reported). */
export type ComputedPatch = {
  readonly patch: InitPatch
  readonly next?: string
}

function insertImport(text: string, statement: string): string {
  const lines = text.split('\n')
  const semicolon = lines.some((line) => /^import\s.*;\s*$/.test(line))
  const line = semicolon ? `${statement};` : statement
  let lastImportEnd = -1
  let isOpen = false
  const closes =
    /\bfrom\s+['"][^'"]+['"]\s*;?\s*$|^import\s+['"][^'"]+['"]\s*;?\s*$/
  lines.forEach((current, index) => {
    if (/^import\s/.test(current)) {
      if (closes.test(current)) {
        lastImportEnd = index
        isOpen = false
      } else {
        isOpen = true
      }
    } else if (isOpen && closes.test(current)) {
      lastImportEnd = index
      isOpen = false
    }
  })
  if (lastImportEnd === -1) {
    // After a leading 'use server' / 'use client' directive, else at the top.
    const directive = /^\s*['"]use [a-z]+['"];?\s*$/.test(lines[0] ?? '')
    lines.splice(directive ? 1 : 0, 0, line)
    return lines.join('\n')
  }
  lines.splice(lastImportEnd + 1, 0, line)
  return lines.join('\n')
}

function indentOf(line: string): string {
  return /^\s*/.exec(line)?.[0] ?? ''
}

/** The indent of the first line inside an object opened on `lines[index]`. */
function innerIndent(lines: readonly string[], index: number): string {
  const opener = indentOf(lines[index] ?? '')
  const next = lines[index + 1] ?? ''
  const nextIndent = indentOf(next)
  return next.trim() !== '' &&
    !next.trim().startsWith('}') &&
    nextIndent.length > opener.length
    ? nextIndent
    : `${opener}  `
}

function computed(
  path: string,
  before: string,
  after: string,
  meta: Pick<InitPatch, 'id' | 'title' | 'description'>
): ComputedPatch {
  return {
    patch: {
      ...meta,
      path,
      status: 'pending',
      baseSha256: sha256Hex(before),
      diff: unifiedDiff(normalizeEol(before), after, { fromPath: path }),
    },
    next: after,
  }
}

function manual(
  path: string,
  meta: Pick<InitPatch, 'id' | 'title' | 'description'>,
  snippet: string
): ComputedPatch {
  return { patch: { ...meta, path, status: 'manual', snippet } }
}

const BETTER_AUTH_SNIPPET = (lifecycle: boolean): string =>
  [
    'betterAuth({',
    '  emailVerification: { sendVerificationEmail: brewEmails.sendVerificationEmail },',
    '  emailAndPassword: { enabled: true, sendResetPassword: brewEmails.sendResetPassword },',
    ...(lifecycle
      ? [
          '  databaseHooks: { user: { create: { after: brewEmails.onUserCreated } } },',
        ]
      : []),
    '  plugins: [magicLink({ sendMagicLink: brewEmails.sendMagicLink })],',
    '})',
  ].join('\n')

/** Wires `brewEmails` into the Better Auth config. */
export function betterAuthPatch(
  project: ProjectDetection,
  authHelper: string,
  options: { readonly lifecycle: boolean }
): ComputedPatch {
  const config = findAuthConfig(project.root, 'better-auth')
  const meta = {
    id: 'better-auth-config',
    title: 'Send Better Auth emails through Brew',
    description:
      'Adds the brewEmails callbacks to betterAuth({ … }): verification email, password reset' +
      (options.lifecycle ? ', and the welcome email on sign-up' : '') +
      '. Magic-link and one-time-code plugins take brewEmails.sendMagicLink and brewEmails.sendVerificationOTP.',
  }
  const snippet = BETTER_AUTH_SNIPPET(options.lifecycle)
  if (config === null) {
    return manual('auth.ts', meta, snippet)
  }
  const text = normalizeEol(config.text)
  const importLine = `import { brewEmails } from '${relativeImport(config.path, authHelper.replace(/\.(ts|js)$/, ''), importSuffix(project))}'`
  if (text.includes('brewEmails')) {
    return {
      patch: { ...meta, path: config.path, status: 'already-applied' },
    }
  }
  const lines = text.split('\n')
  const openers = lines.flatMap((line, index) =>
    /\bbetterAuth\(\s*\{\s*$/.test(line) ? [index] : []
  )
  const owned = [
    'sendVerificationEmail',
    'sendResetPassword',
    'emailVerification',
    ...(options.lifecycle ? ['databaseHooks'] : []),
  ].filter((name) => text.includes(name))
  const opener = openers[0]
  if (openers.length !== 1 || opener === undefined || owned.length > 0) {
    return manual(
      config.path,
      {
        ...meta,
        description: `${meta.description} ${
          owned.length > 0
            ? `The config already sets ${owned.join(', ')}: replace your sender by hand.`
            : 'The betterAuth({ … }) call could not be located safely.'
        } Import: ${importLine}`,
      },
      snippet
    )
  }
  const indent = innerIndent(lines, opener)
  const inserted = [
    `${indent}emailVerification: { sendVerificationEmail: brewEmails.sendVerificationEmail },`,
    ...(options.lifecycle
      ? [
          `${indent}databaseHooks: { user: { create: { after: brewEmails.onUserCreated } } },`,
        ]
      : []),
  ]
  const next = [...lines]
  // Bottom-up, so earlier indexes stay valid.
  const passwordLines = next.flatMap((line, index) =>
    /^\s*emailAndPassword\s*:\s*\{\s*$/.test(line) ? [index] : []
  )
  const passwordLine = passwordLines[0]
  const resetInserted = passwordLines.length === 1 && passwordLine !== undefined
  if (resetInserted) {
    next.splice(
      passwordLine + 1,
      0,
      `${innerIndent(next, passwordLine)}sendResetPassword: brewEmails.sendResetPassword,`
    )
  }
  next.splice(opener + 1, 0, ...inserted)
  // The description must not promise a reset hook the diff does not add.
  const described =
    resetInserted || !/\bemailAndPassword\b/.test(text)
      ? meta
      : {
          ...meta,
          description: `${meta.description} emailAndPassword is not on its own lines here, so the patch leaves it alone: add sendResetPassword: brewEmails.sendResetPassword to it by hand.`,
        }
  return computed(
    config.path,
    config.text,
    insertImport(next.join('\n'), importLine),
    described
  )
}

/** Adds `brewEmailProvider` to the Auth.js providers. */
export function authjsPatch(
  project: ProjectDetection,
  authHelper: string
): ComputedPatch {
  const config = findAuthConfig(project.root, 'authjs')
  const meta = {
    id: 'authjs-config',
    title: 'Send Auth.js sign-in links through Brew',
    description:
      'Adds brewEmailProvider to providers. Email sign-in needs a database adapter; send the welcome email from events.createUser with sendWelcomeEmail.',
  }
  const snippet = 'providers: [brewEmailProvider, /* your other providers */],'
  if (config === null) {
    return manual(
      project.authVersion === 'v4'
        ? 'pages/api/auth/[...nextauth].ts'
        : 'auth.ts',
      meta,
      snippet
    )
  }
  const text = normalizeEol(config.text)
  const importLine = `import { brewEmailProvider } from '${relativeImport(config.path, authHelper.replace(/\.(ts|js)$/, ''), importSuffix(project))}'`
  if (text.includes('brewEmailProvider')) {
    return {
      patch: { ...meta, path: config.path, status: 'already-applied' },
    }
  }
  // Auth.js refuses an email provider without a database adapter at
  // startup (MissingAdapter): adding one to an adapter-less config would
  // break sign-in for every provider.
  if (!/\badapter\s*:/.test(text)) {
    return manual(
      config.path,
      {
        ...meta,
        description: `${meta.description} This config has no database adapter, which Auth.js email sign-in requires: add one first, then add the provider. Import: ${importLine}`,
      },
      snippet
    )
  }
  const existingSender =
    /\b(EmailProvider|Nodemailer|Resend|Sendgrid|Postmark)\(|sendVerificationRequest/.test(
      text
    )
  const lines = text.split('\n')
  const providerLines = lines.flatMap((line, index) =>
    /\bproviders\s*:\s*\[/.test(line) ? [index] : []
  )
  const at = providerLines[0]
  if (existingSender || providerLines.length !== 1 || at === undefined) {
    return manual(
      config.path,
      {
        ...meta,
        description: `${meta.description} ${
          existingSender
            ? 'The config already has an email provider: replace it by hand.'
            : 'The providers list could not be located safely.'
        } Import: ${importLine}`,
      },
      snippet
    )
  }
  const line = lines[at] ?? ''
  const next = [...lines]
  if (/\bproviders\s*:\s*\[\s*$/.test(line)) {
    next.splice(at + 1, 0, `${innerIndent(lines, at)}brewEmailProvider,`)
  } else {
    next[at] = line.replace(/\bproviders\s*:\s*\[\s*/, (match) =>
      /\[\s*\]/.test(line)
        ? `${match}brewEmailProvider`
        : `${match}brewEmailProvider, `
    )
  }
  return computed(
    config.path,
    config.text,
    insertImport(next.join('\n'), importLine),
    meta
  )
}

/** Turns the Send Email Hook on in `supabase/config.toml` (local dev). */
export function supabaseConfigPatch(project: ProjectDetection): ComputedPatch {
  const path = 'supabase/config.toml'
  const meta = {
    id: 'supabase-config-hook',
    title: 'Turn on the Supabase Send Email Hook locally',
    description:
      'Points [auth.hook.send_email] at the send-email function for `supabase start`. In production, set the hook in the Supabase dashboard (Authentication > Hooks).',
  }
  const text = readTextFile(join(project.root, path))
  if (text === null) {
    return manual(path, meta, SUPABASE_CONFIG_BLOCK)
  }
  const normalized = normalizeEol(text)
  if (normalized.includes('[auth.hook.send_email]')) {
    return normalized.includes('/functions/v1/send-email')
      ? { patch: { ...meta, path, status: 'already-applied' } }
      : manual(
          path,
          {
            ...meta,
            description: `${meta.description} A send_email hook is already configured: point it at send-email by hand.`,
          },
          SUPABASE_CONFIG_BLOCK
        )
  }
  const separator = normalized.endsWith('\n') ? '\n' : '\n\n'
  return computed(
    path,
    text,
    `${normalized}${separator}${SUPABASE_CONFIG_BLOCK}\n`,
    meta
  )
}

/**
 * Applies a pending patch when the file still hashes to its base: the
 * writer's managed-hash check makes "unchanged since planned" the only way
 * in. Anything else is reported `stale`.
 */
export function applyPatch(
  writer: ProjectWriter,
  computedPatch: ComputedPatch
): InitPatch {
  const { patch, next } = computedPatch
  if (patch.status !== 'pending' || next === undefined) {
    return patch
  }
  const change = writer.writeFile(patch.path, next, {
    ...(patch.baseSha256 === undefined
      ? {}
      : { managedSha256: patch.baseSha256 }),
  })
  if (change.action === 'updated' || change.action === 'unchanged') {
    return { ...patch, status: writer.dryRun ? 'pending' : 'applied' }
  }
  return { ...patch, status: 'stale' }
}
