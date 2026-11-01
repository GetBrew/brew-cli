import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, extname, join, relative, sep } from 'node:path'
import {
  type ArgumentAnalysis,
  analyzeArgument,
  reactEmailRuntimeMarkers,
} from './analyze'
import { locateWithTokens } from './locate'
import {
  locateWithTypeScript,
  type TypeScriptModule,
} from './locate-typescript'
import { allowsJsx, memberAt, type Token, tokenize } from './tokenize'
import type { ClientSite, FileLocations, ScanEngine } from './types'

/**
 * The project-wide code scan: every file that may send through Resend, its
 * clients (followed across files through relative imports), each send call
 * classified, and the React Email templates in the project.
 */

const SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]
const SKIP_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  '.output',
  '.svelte-kit',
  '.vercel',
  '.netlify',
  '.turbo',
  '.react-email',
  '.wrangler',
  '.cache',
  'dist',
  'build',
  'out',
  'coverage',
])
const MAX_FILES = 20_000
const MAX_FILE_BYTES = 1_000_000
/**
 * A file the send scan reads: it names Resend, or has an `emails.send` /
 * `batch.send` in any form the scan reads as one (`.emails.send`,
 * `?.emails?.send`, `['emails'].send`, `["batch"]["send"]`), so a caller
 * that sends through a shared client under another name is never skipped.
 */
const SEND_HINT =
  /resend|(?:\.\s*|\[\s*['"`])(?:emails|batch)\b['"`]?\s*\]?\s*(?:\?\.|\.)?\s*(?:\[\s*['"`])?send\b/i
const REACT_EMAIL_IMPORT = /from\s*['"](?:@react-email\/[^'"]+|react-email)['"]/

export type ScannedClient = {
  /** `src/lib/resend.ts#resend`, or `src/x.ts:12` for an unnamed client. */
  readonly id: string
  readonly file: string
  readonly binding: string | null
  readonly exportName: string | null
  readonly line: number
  readonly column: number
  readonly inline: boolean
  readonly site: ClientSite
  /** The first file that uses it for more than emails.send and batch.send, or null. */
  readonly usedBeyondSendIn: string | null
}

export type ScannedCallSite = {
  readonly file: string
  readonly line: number
  readonly column: number
  readonly method: 'emails.send' | 'batch.send'
  readonly receiver: string
  /** The client this call goes through; null when it could not be followed. */
  readonly clientId: string | null
  readonly analysis: ArgumentAnalysis
}

export type ReactEmailFile = {
  /** Project-relative, POSIX. */
  readonly file: string
  /** Why it is migrated by hand (relative imports, runtime logic); empty when it imports as is. */
  readonly manualReasons: readonly string[]
}

export type ScannedFile = {
  readonly text: string
  readonly locations: FileLocations
}

export type CodeScan = {
  readonly engine: ScanEngine
  readonly filesScanned: number
  readonly truncated: boolean
  /** Files that import `resend` or hold a send call, by project-relative path. */
  readonly files: ReadonlyMap<string, ScannedFile>
  readonly clients: readonly ScannedClient[]
  readonly callSites: readonly ScannedCallSite[]
  readonly reactEmail: readonly ReactEmailFile[]
}

export type CodeScanOptions = {
  /**
   * The TypeScript compiler to parse with. Absent: the project's own
   * (`typescript` resolved from its root), else the built-in tokenizer.
   * `null` forces the tokenizer.
   */
  readonly typescript?: TypeScriptModule | null
}

function toPosix(path: string): string {
  return path.split(sep).join('/')
}

/** The project's own TypeScript compiler, when it is installed and recent enough. */
export function loadProjectTypeScript(root: string): TypeScriptModule | null {
  try {
    const require = createRequire(join(root, 'package.json'))
    const ts = require('typescript') as TypeScriptModule
    return typeof ts.createSourceFile === 'function' &&
      typeof ts.getModifiers === 'function' &&
      typeof ts.isSatisfiesExpression === 'function'
      ? ts
      : null
  } catch {
    return null
  }
}

function listSourceFiles(root: string): {
  files: string[]
  truncated: boolean
} {
  const files: string[] = []
  let truncated = false
  const walk = (dir: string): void => {
    let entries: string[]
    try {
      entries = readdirSync(dir).sort()
    } catch {
      return
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) {
        truncated = true
        return
      }
      const path = join(dir, entry)
      let stats: ReturnType<typeof lstatSync>
      try {
        stats = lstatSync(path)
      } catch {
        continue
      }
      if (stats.isSymbolicLink()) {
        continue
      }
      if (stats.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry) && !entry.startsWith('.')) {
          walk(path)
        }
        continue
      }
      if (
        stats.isFile() &&
        SOURCE_EXTENSIONS.includes(extname(entry)) &&
        !entry.endsWith('.d.ts')
      ) {
        files.push(path)
      }
    }
  }
  walk(root)
  return { files, truncated }
}

/** The file a project import names, resolved the way bundlers do. */
export function resolveProjectModule(
  root: string,
  fromFile: string,
  specifier: string
): string | null {
  const bases: string[] = []
  if (/^[@~]\//.test(specifier)) {
    const rest = specifier.slice(2)
    bases.push(join(root, rest), join(root, 'src', rest))
  } else {
    bases.push(join(dirname(fromFile), specifier))
  }
  for (const base of bases) {
    const candidates = [base]
    const stripped = base.replace(/\.(?:js|jsx|mjs|cjs)$/, '')
    for (const extension of SOURCE_EXTENSIONS) {
      candidates.push(`${stripped}${extension}`)
    }
    for (const extension of SOURCE_EXTENSIONS) {
      candidates.push(join(base, `index${extension}`))
    }
    for (const candidate of candidates) {
      try {
        if (statSync(candidate).isFile()) {
          return candidate
        }
      } catch {}
    }
  }
  return null
}

function locate(
  ts: TypeScriptModule | null,
  text: string,
  path: string
): { readonly locations: FileLocations; readonly engine: ScanEngine } {
  if (ts !== null) {
    try {
      return {
        locations: locateWithTypeScript(ts, text, path),
        engine: 'typescript',
      }
    } catch {}
  }
  return { locations: locateWithTokens(text, path), engine: 'tokenizer' }
}

export function scanProject(
  root: string,
  options: CodeScanOptions = {}
): CodeScan {
  const ts =
    options.typescript === undefined
      ? loadProjectTypeScript(root)
      : options.typescript
  const listed = listSourceFiles(root)
  const files = new Map<string, ScannedFile>()
  const reactEmail: ReactEmailFile[] = []
  let usedTypeScript = false
  let truncated = listed.truncated
  for (const absolute of listed.files) {
    let text: string
    try {
      text = readFileSync(absolute, 'utf8')
    } catch {
      continue
    }
    const file = toPosix(relative(root, absolute))
    const isReactEmail =
      /\.(?:tsx|jsx|js)$/.test(file) &&
      REACT_EMAIL_IMPORT.test(text) &&
      /\bexport\s+default\b/.test(text) &&
      /<Html[\s>]/.test(text)
    if (!SEND_HINT.test(text) && !isReactEmail) {
      continue
    }
    if (text.length > MAX_FILE_BYTES) {
      // Too big to parse, and it may send: the scan is incomplete.
      truncated = true
      continue
    }
    const located = locate(ts, text, file)
    usedTypeScript ||= located.engine === 'typescript'
    if (isReactEmail) {
      const reasons = [
        ...located.locations.localImports.map(
          (entry) => `imports ${entry.from}`
        ),
        ...reactEmailRuntimeMarkers(text, file).map(
          (marker) => `runs ${marker}`
        ),
      ]
      reactEmail.push({ file, manualReasons: [...new Set(reasons)] })
    }
    if (
      located.locations.imports.length > 0 ||
      located.locations.calls.length > 0
    ) {
      files.set(file, { text, locations: located.locations })
    }
  }

  // Clients, by file and by the name other files import them as.
  const found: Array<Omit<ScannedClient, 'usedBeyondSendIn'>> = []
  for (const [file, scanned] of files) {
    for (const site of scanned.locations.clients) {
      found.push({
        id:
          site.binding === null
            ? `${file}:${site.line}`
            : `${file}#${site.binding}`,
        file,
        binding: site.binding,
        exportName: site.exportName,
        line: site.line,
        column: site.column,
        inline: site.inline,
        site,
      })
    }
  }
  const users = clientUsers(root, ts, listed.files, files, found)
  truncated ||= users.truncated
  const clients: ScannedClient[] = found.map((client) => ({
    ...client,
    usedBeyondSendIn: users.byClient.get(client.id) ?? null,
  }))
  const clientByBinding = new Map(
    clients
      .filter((client) => client.binding !== null)
      .map((client) => [`${client.file}#${client.binding}`, client] as const)
  )
  const clientByExport = new Map(
    clients
      .filter((client) => client.exportName !== null)
      .map((client) => [`${client.file}#${client.exportName}`, client] as const)
  )

  const callSites: ScannedCallSite[] = []
  for (const [file, scanned] of files) {
    const { locations } = scanned
    const hasResendImport = locations.imports.some((entry) => !entry.typeOnly)
    for (const call of locations.calls) {
      let clientId: string | null = null
      if (call.inlineClient) {
        const inline = clients.find(
          (client) =>
            client.file === file && client.inline && client.line === call.line
        )
        clientId = inline?.id ?? `${file}:${call.line}`
      } else {
        const local = clientByBinding.get(`${file}#${call.receiver}`)
        if (local !== undefined) {
          clientId = local.id
        } else {
          const head = call.receiver.split(/\??\./)[0] ?? call.receiver
          const imported = locations.localImports.find(
            (entry) => entry.local === head
          )
          if (imported !== undefined) {
            const target = resolveProjectModule(
              root,
              join(root, file),
              imported.from
            )
            if (target !== null) {
              const targetFile = toPosix(relative(root, target))
              const name =
                imported.imported === '*'
                  ? (call.receiver.split(/\??\./)[1] ?? '')
                  : imported.imported
              clientId = clientByExport.get(`${targetFile}#${name}`)?.id ?? null
            }
          }
        }
      }
      // A call through something that is not a known client counts only
      // when it plausibly is one: the file uses Resend, or the receiver is
      // named for it.
      if (
        clientId === null &&
        !hasResendImport &&
        !/resend/i.test(call.receiver)
      ) {
        continue
      }
      callSites.push({
        file,
        line: call.line,
        column: call.column,
        method: call.method,
        receiver: call.receiver,
        clientId,
        analysis: analyzeArgument(scanned.text, call.args, file),
      })
    }
  }
  callSites.sort((a, b) =>
    a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1
  )

  return {
    engine: usedTypeScript ? 'typescript' : 'tokenizer',
    filesScanned: listed.files.length,
    truncated,
    files,
    clients,
    callSites,
    reactEmail,
  }
}

function isDot(token: Token | undefined): boolean {
  return (
    token?.type === 'punct' && (token.value === '.' || token.value === '?.')
  )
}

/** The index after `a.b.c` (or `a?.b`) at `at`, or -1. */
function pathEnd(
  tokens: readonly Token[],
  at: number,
  names: readonly string[]
): number {
  let index = at
  for (const [position, name] of names.entries()) {
    if (position > 0) {
      if (!isDot(tokens[index])) {
        return -1
      }
      index += 1
    }
    const token = tokens[index]
    if (token?.type !== 'ident' || token.value !== name) {
      return -1
    }
    index += 1
  }
  return index
}

/**
 * Whether code (never a comment or a string) reaches `path`, a client's
 * binding or import, for more than `emails.send` and `batch.send`. A
 * literal computed member (`['emails']`) reads as its dot form; any other
 * computed member (`[key]`) may be anything, so it is more.
 */
function reachesBeyondSend(
  tokens: readonly Token[],
  path: readonly string[]
): boolean {
  return tokens.some((token, index) => {
    if (
      token.children !== undefined &&
      reachesBeyondSend(token.children, path)
    ) {
      return true
    }
    const end = isDot(tokens[index - 1]) ? -1 : pathEnd(tokens, index, path)
    const group = end === -1 ? null : memberAt(tokens, end)
    if (group === null) {
      return false
    }
    return (
      (group.name !== 'emails' && group.name !== 'batch') ||
      memberAt(tokens, group.next)?.name !== 'send'
    )
  })
}

/**
 * The first file that uses each client for more than `emails.send` and
 * `batch.send` (all the Brew client has): its own file through its binding,
 * or any project file whose import resolves to its module. Such an import
 * names the module (its folder for an index file) or is `./`, so only files
 * holding that are parsed; `truncated` when one is too big to.
 */
function clientUsers(
  root: string,
  ts: TypeScriptModule | null,
  listed: readonly string[],
  files: ReadonlyMap<string, ScannedFile>,
  clients: ReadonlyArray<Omit<ScannedClient, 'usedBeyondSendIn'>>
): {
  readonly byClient: ReadonlyMap<string, string>
  readonly truncated: boolean
} {
  const byClient = new Map<string, string>()
  let truncated = false
  const uses = (file: string, text: string, path: readonly string[]) => {
    try {
      return reachesBeyondSend(tokenize(text, { jsx: allowsJsx(file) }), path)
    } catch {
      return true
    }
  }
  for (const client of clients) {
    const own = files.get(client.file)
    if (
      client.binding !== null &&
      own !== undefined &&
      uses(client.file, own.text, client.binding.split('.'))
    ) {
      byClient.set(client.id, client.file)
    }
  }
  const shared = clients.filter((client) => client.exportName !== null)
  for (const absolute of shared.length === 0 ? [] : listed) {
    const file = toPosix(relative(root, absolute))
    let text: string
    try {
      text = files.get(file)?.text ?? readFileSync(absolute, 'utf8')
    } catch {
      continue
    }
    const named = shared.filter(
      (client) =>
        client.file !== file &&
        !byClient.has(client.id) &&
        (text.includes(reactEmailBaseName(client.file)) ||
          /['"](?:\.{1,2}|[@~])\/['"]/.test(text))
    )
    if (named.length === 0) {
      continue
    }
    if (text.length > MAX_FILE_BYTES) {
      truncated = true
      continue
    }
    const { localImports } =
      files.get(file)?.locations ?? locate(ts, text, file).locations
    for (const entry of localImports) {
      const target = resolveProjectModule(root, absolute, entry.from)
      for (const client of named) {
        const path =
          target === null || toPosix(relative(root, target)) !== client.file
            ? null
            : entry.imported === '*'
              ? [entry.local, client.exportName ?? '']
              : entry.imported === client.exportName
                ? [entry.local]
                : null
        if (
          path !== null &&
          !byClient.has(client.id) &&
          uses(file, text, path)
        ) {
          byClient.set(client.id, file)
        }
      }
    }
  }
  return { byClient, truncated }
}

/** The key a React Email file migrates under (before prefix and uniqueness). */
export function reactEmailBaseName(file: string): string {
  const name = basename(file, extname(file))
  return name === 'index' ? basename(dirname(file)) : name
}

/** Whether `lib/brew.ts` (written by init) exists, for suggested replacements. */
export function hasBrewClientFile(
  root: string,
  libDir: string | null
): boolean {
  const dir = libDir ?? 'lib'
  return ['ts', 'js', 'mjs'].some((extension) =>
    existsSync(join(root, dir, `brew.${extension}`))
  )
}
