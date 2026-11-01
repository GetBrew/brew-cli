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
  // Imports are read from code: one in a comment is not the last import.
  const code = withoutComments(text, true).split('\n')
  const semicolon = code.some((line) => /^import\s.*;\s*$/.test(line))
  const line = semicolon ? `${statement};` : statement
  let lastImportEnd = -1
  let isOpen = false
  const closes =
    /\bfrom\s+['"][^'"]+['"]\s*;?\s*$|^import\s+['"][^'"]+['"]\s*;?\s*$/
  code.forEach((current, index) => {
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

/**
 * Source text with its `//` and `/* *\/` comments left out (strings kept).
 * `keepLines` blanks each comment to spaces instead, newlines kept, so a
 * line found in the result is the same line of `text`, at the same columns.
 */
function withoutComments(text: string, keepLines = false): string {
  const blank = (from: number, to: number) =>
    text.slice(from, to).replace(/[^\n]/g, ' ')
  let out = ''
  let index = 0
  while (index < text.length) {
    const char = text[index] ?? ''
    const next = text[index + 1]
    if (char === '/' && next === '/') {
      const end = text.indexOf('\n', index)
      const stop = end === -1 ? text.length : end
      out += keepLines ? blank(index, stop) : ''
      index = stop
    } else if (char === '/' && next === '*') {
      const end = text.indexOf('*/', index + 2)
      const stop = end === -1 ? text.length : end + 2
      out += keepLines ? blank(index, stop) : ' '
      index = stop
    } else if (char === '"' || char === "'" || char === '`') {
      let end = index + 1
      while (end < text.length && text[end] !== char) {
        end += text[end] === '\\' ? 2 : 1
      }
      out += text.slice(index, end + 1)
      index = end + 1
    } else {
      out += char
      index += 1
    }
  }
  return out
}

/** Code with its import declarations and `require` destructurings left out. */
function withoutImports(code: string): string {
  return code
    .replace(/\bimport\s[\s\S]*?\bfrom\s*(['"])[^'"]*\1/g, '')
    .replace(
      /\b(?:const|let|var)\s*\{[^}]*\}\s*=\s*require\(\s*(['"])[^'"]*\1\s*\)/g,
      ''
    )
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

/** A quoted string or template literal. */
const LITERAL = /(['"`])(?:\\.|(?!\1)[^\\])*\1/g

/**
 * The diff a report prints. The file is the user's (an auth config, where
 * a secret may sit on any line), so it carries no context lines, and a
 * hunk that changes the user's lines shows their shape, never their values.
 */
function reportedDiff(path: string, before: string, after: string): string {
  return unifiedDiff(before, after, { fromPath: path, context: 0 })
    .split(/(?=^@@ )/m)
    .map((hunk) =>
      hunk.startsWith('@@') && /^-/m.test(hunk)
        ? hunk.replace(/^[-+].*$/gm, (line) => line.replace(LITERAL, '$1…$1'))
        : hunk
    )
    .join('')
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
      diff: reportedDiff(path, normalizeEol(before), after),
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

/** The kit sets a patch wires. */
export type AuthPatchOptions = {
  /** `lifecycle.welcome` exists: wire the welcome email. */
  readonly lifecycle: boolean
  /** The auth keys exist: wire the auth library's own emails. */
  readonly auth: boolean
}

/** The generated auth helper, as a relative import from `from`. */
function helperImport(
  project: ProjectDetection,
  from: string,
  authHelper: string
): string {
  return relativeImport(
    from,
    authHelper.replace(/\.(ts|m?js)$/, ''),
    importSuffix(project)
  )
}

function betterAuthSnippet(
  options: AuthPatchOptions,
  workers: boolean
): string {
  return [
    ...(workers
      ? ['const brewEmails = createBrewEmails(env) // per request']
      : []),
    'betterAuth({',
    ...(options.auth
      ? [
          '  emailVerification: { sendVerificationEmail: brewEmails.sendVerificationEmail },',
          '  emailAndPassword: { enabled: true, sendResetPassword: brewEmails.sendResetPassword },',
        ]
      : []),
    ...(options.lifecycle
      ? [
          '  databaseHooks: { user: { create: { after: brewEmails.onUserCreated } } },',
        ]
      : []),
    ...(options.auth
      ? ['  plugins: [magicLink({ sendMagicLink: brewEmails.sendMagicLink })],']
      : []),
    '})',
  ].join('\n')
}

/** Wires `brewEmails` into the Better Auth config, for the sets set up. */
export function betterAuthPatch(
  project: ProjectDetection,
  authHelper: string,
  options: AuthPatchOptions
): ComputedPatch {
  const config = findAuthConfig(project.root, 'better-auth')
  const workers = project.runtime === 'workers'
  const meta = {
    id: 'better-auth-config',
    title: 'Send Better Auth emails through Brew',
    description: `Adds the brewEmails callbacks to betterAuth({ … }): ${[
      ...(options.auth ? ['verification email', 'password reset'] : []),
      ...(options.lifecycle ? ['the welcome email on sign-up'] : []),
    ].join(', ')}.${
      options.auth
        ? ' Magic-link and one-time-code plugins take brewEmails.sendMagicLink and brewEmails.sendVerificationOTP.'
        : ''
    }`,
  }
  const snippet = betterAuthSnippet(options, workers)
  if (config === null) {
    return manual('auth.ts', meta, snippet)
  }
  const text = normalizeEol(config.text)
  const importLine = `import { ${workers ? 'createBrewEmails' : 'brewEmails'} } from '${helperImport(project, config.path, authHelper)}'`
  // What the sets need: a re-run with another set finds what is missing
  // (a commented-out callback is missing).
  const uncommented = withoutComments(text)
  const password = /\bemailAndPassword\b/.test(uncommented)
  const missing = [
    ...(options.auth ? ['sendVerificationEmail'] : []),
    ...(options.auth && password ? ['sendResetPassword'] : []),
    ...(options.lifecycle ? ['onUserCreated'] : []),
  ].filter((name) => !uncommented.includes(`brewEmails.${name}`))
  if (missing.length === 0) {
    return {
      patch: { ...meta, path: config.path, status: 'already-applied' },
    }
  }
  const lines = text.split('\n')
  // Insertion points come from code only: a commented-out example is never
  // the config.
  const code = withoutComments(text, true).split('\n')
  const openers = code.flatMap((line, index) =>
    /\bbetterAuth\(\s*\{\s*$/.test(line) ? [index] : []
  )
  const opener = openers.length === 1 ? openers[0] : undefined
  const passwordLines = code.flatMap((line, index) =>
    /^\s*emailAndPassword\s*:\s*\{\s*$/.test(line) ? [index] : []
  )
  const owned = [
    ...(options.auth
      ? ['sendVerificationEmail', 'sendResetPassword', 'emailVerification']
      : []),
    ...(options.lifecycle ? ['databaseHooks'] : []),
  ].filter((name) => text.includes(name))
  const reason = workers
    ? 'On Workers, build brewEmails per request with createBrewEmails(env) where betterAuth({ … }) is built, then add the callbacks.'
    : text.includes('brewEmails')
      ? `The config already uses brewEmails: add ${missing.join(', ')} by hand.`
      : owned.length > 0
        ? `The config already sets ${owned.join(', ')}: replace your sender by hand.`
        : opener === undefined
          ? 'The betterAuth({ … }) call could not be located safely.'
          : options.auth && password && passwordLines.length !== 1
            ? 'emailAndPassword is not on its own lines: add sendResetPassword: brewEmails.sendResetPassword to it by hand.'
            : undefined
  if (reason !== undefined || opener === undefined) {
    return manual(
      config.path,
      {
        ...meta,
        description: `${meta.description} ${reason} Import: ${importLine}`,
      },
      snippet
    )
  }
  const indent = innerIndent(lines, opener)
  const next = [...lines]
  // Bottom-up, so earlier indexes stay valid.
  const passwordLine = passwordLines[0]
  if (options.auth && passwordLine !== undefined) {
    next.splice(
      passwordLine + 1,
      0,
      `${innerIndent(next, passwordLine)}sendResetPassword: brewEmails.sendResetPassword,`
    )
  }
  next.splice(
    opener + 1,
    0,
    ...(options.auth
      ? [
          `${indent}emailVerification: { sendVerificationEmail: brewEmails.sendVerificationEmail },`,
        ]
      : []),
    ...(options.lifecycle
      ? [
          `${indent}databaseHooks: { user: { create: { after: brewEmails.onUserCreated } } },`,
        ]
      : [])
  )
  return computed(
    config.path,
    config.text,
    insertImport(next.join('\n'), importLine),
    meta
  )
}

/** Adds `brewEmailProvider` to the Auth.js providers. */
export function authjsPatch(
  project: ProjectDetection,
  authHelper: string
): ComputedPatch {
  const config = findAuthConfig(project.root, 'authjs')
  const workers = project.runtime === 'workers'
  const meta = {
    id: 'authjs-config',
    title: 'Send Auth.js sign-in links through Brew',
    description:
      'Adds brewEmailProvider to providers. Email sign-in needs a database adapter; send the welcome email from events.createUser with sendWelcomeEmail.',
  }
  const snippet = `providers: [${workers ? 'createBrewEmailProvider(env)' : 'brewEmailProvider'}, /* your other providers */],`
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
  const importLine = `import { ${workers ? 'createBrewEmailProvider' : 'brewEmailProvider'} } from '${helperImport(project, config.path, authHelper)}'`
  // Wired only where the config's code uses it: an import or a comment
  // naming it is not. Also finds createBrewEmailProvider(…), the Workers form.
  const uncommented = withoutComments(text)
  if (
    /\b(?:brewEmailProvider|createBrewEmailProvider)\b/.test(
      withoutImports(uncommented)
    )
  ) {
    return {
      patch: { ...meta, path: config.path, status: 'already-applied' },
    }
  }
  if (/\b(?:brewEmailProvider|createBrewEmailProvider)\b/.test(uncommented)) {
    return manual(
      config.path,
      {
        ...meta,
        description: `${meta.description} The config imports the provider but does not use it: add it to providers by hand.`,
      },
      snippet
    )
  }
  // Auth.js refuses an email provider without a database adapter at
  // startup (MissingAdapter): adding one to an adapter-less config would
  // break sign-in for every provider. A commented-out adapter is none.
  if (!/\badapter\s*:/.test(uncommented)) {
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
  // Insertion points come from code only: a providers list in a comment is
  // never the config's.
  const code = withoutComments(text, true).split('\n')
  const providerLines = code.flatMap((line, index) =>
    /\bproviders\s*:\s*\[/.test(line) ? [index] : []
  )
  const at = providerLines[0]
  if (
    workers ||
    existingSender ||
    providerLines.length !== 1 ||
    at === undefined
  ) {
    return manual(
      config.path,
      {
        ...meta,
        description: `${meta.description} ${
          workers
            ? 'On Workers, add createBrewEmailProvider(env) to the providers you build per request.'
            : existingSender
              ? 'The config already has an email provider: replace it by hand.'
              : 'The providers list could not be located safely.'
        } Import: ${importLine}`,
      },
      snippet
    )
  }
  const line = lines[at] ?? ''
  const codeLine = code[at] ?? ''
  const next = [...lines]
  if (/\bproviders\s*:\s*\[\s*$/.test(codeLine)) {
    next.splice(at + 1, 0, `${innerIndent(lines, at)}brewEmailProvider,`)
  } else {
    // At the list's column in code (columns match `line`'s).
    const open = /\bproviders\s*:\s*\[\s*/.exec(codeLine)
    const end = (open?.index ?? 0) + (open?.[0].length ?? 0)
    next[at] = `${line.slice(0, end)}${
      /\bproviders\s*:\s*\[\s*\]/.test(codeLine)
        ? 'brewEmailProvider'
        : 'brewEmailProvider, '
    }${line.slice(end)}`
  }
  return computed(
    config.path,
    config.text,
    insertImport(next.join('\n'), importLine),
    meta
  )
}

/** A TOML table's header line, when in effect (not commented out). */
function tomlTable(text: string, name: string): RegExpExecArray | null {
  return new RegExp(
    `^[ \\t]*\\[[ \\t]*${name.replaceAll('.', '\\.')}[ \\t]*\\][ \\t]*(?:#.*)?$`,
    'm'
  ).exec(text)
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
  const hook = tomlTable(normalized, 'auth.hook.send_email')
  if (hook !== null) {
    // The table's own lines, up to the next table.
    const rest = normalized.slice(hook.index + hook[0].length)
    const body = rest.slice(0, /^[ \t]*\[/m.exec(rest)?.index ?? rest.length)
    return /^[ \t]*enabled[ \t]*=[ \t]*true\b/m.test(body) &&
      /^[ \t]*uri[ \t]*=[ \t]*"[^"]*\/functions\/v1\/send-email"/m.test(body)
      ? { patch: { ...meta, path, status: 'already-applied' } }
      : manual(
          path,
          {
            ...meta,
            description: `${meta.description} A send_email hook is already configured: enable it and point it at send-email by hand.`,
          },
          SUPABASE_CONFIG_BLOCK
        )
  }
  // A second [functions.send-email] table would make the file invalid TOML.
  if (tomlTable(normalized, 'functions.send-email') !== null) {
    return manual(
      path,
      {
        ...meta,
        description: `${meta.description} The file already has [functions.send-email]: add the [auth.hook.send_email] table, and verify_jwt = false to the function's, by hand.`,
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
