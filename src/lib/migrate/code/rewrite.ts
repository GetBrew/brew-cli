import { dirname, join, relative, sep } from 'node:path'
import type { CodeScan, ScannedCallSite, ScannedFile } from './scan'

/**
 * `--rewrite-imports`: move a file from `resend` to `@brew.new/sdk/resend`
 * (Brew's Resend-shaped client) by changing its import and pointing its
 * clients at the Brew key and the template map. Only where that is the
 * whole job: every send through the file's clients names a template that
 * migrated, and nothing else is imported from `resend`. Everything else is
 * an agent next step with a suggested `brew.send` replacement.
 */

export const ADAPTER_MODULE = '@brew.new/sdk/resend'
export const MAP_EXPORT = 'brewResendTemplates'

export type RewriteDecision =
  | { readonly file: string; readonly rewritable: true }
  | {
      readonly file: string
      readonly rewritable: false
      readonly reason: string
    }

/**
 * Where the template map goes, by the project's helper directory and
 * language. A CommonJS map is `.cjs`, so a `"type": "module"` package still
 * loads it as CommonJS.
 */
export function mapFilePath(
  libDir: string | null,
  typescript: boolean,
  moduleSyntax: 'esm' | 'cjs'
): string {
  const extension = typescript ? 'ts' : moduleSyntax === 'cjs' ? 'cjs' : 'js'
  return `${libDir ?? 'lib'}/brew-resend-map.${extension}`
}

/**
 * Whether each file that imports `resend` can move to the adapter as is.
 * `knownTemplates` holds every template id and alias that has a migrated
 * key; `allTemplatesMigrated` lets a computed template id through (the map
 * then covers whatever it evaluates to).
 */
export function decideRewrites(
  scan: CodeScan,
  knownTemplates: ReadonlySet<string>,
  allTemplatesMigrated: boolean
): RewriteDecision[] {
  const decisions: RewriteDecision[] = []
  const sitesByClient = new Map<string, ScannedCallSite[]>()
  for (const site of scan.callSites) {
    if (site.clientId !== null) {
      const list = sitesByClient.get(site.clientId) ?? []
      list.push(site)
      sitesByClient.set(site.clientId, list)
    }
  }
  for (const [file, scanned] of scan.files) {
    const valueImports = scanned.locations.imports.filter(
      (entry) => !entry.typeOnly
    )
    if (valueImports.length === 0) {
      continue
    }
    const reason = blockingReason(
      file,
      scanned,
      scan,
      sitesByClient,
      knownTemplates,
      allTemplatesMigrated
    )
    decisions.push(
      reason === null
        ? { file, rewritable: true }
        : { file, rewritable: false, reason }
    )
  }
  return decisions
}

function blockingReason(
  file: string,
  scanned: ScannedFile,
  scan: CodeScan,
  sitesByClient: ReadonlyMap<string, readonly ScannedCallSite[]>,
  knownTemplates: ReadonlySet<string>,
  allTemplatesMigrated: boolean
): string | null {
  if (scan.truncated) {
    return 'the scan did not read every source file, so a send through it could be missed'
  }
  const { locations } = scanned
  for (const entry of locations.imports) {
    if (entry.typeOnly) {
      continue
    }
    const other = entry.importedNames.filter((name) => name !== 'Resend')
    if (other.length > 0 || entry.ctorNames.length === 0) {
      return `it imports ${other.length > 0 ? other.join(', ') : 'the whole module'} from resend, which the Brew client does not provide`
    }
  }
  const clients = scan.clients.filter((client) => client.file === file)
  const sites = [
    ...scan.callSites.filter((site) => site.file === file),
    ...clients.flatMap((client) => sitesByClient.get(client.id) ?? []),
    // A send whose client could not be followed may go through any of them.
    ...(clients.length === 0
      ? []
      : scan.callSites.filter((site) => site.clientId === null)),
  ]
  if (sites.length === 0 && clients.length === 0) {
    return 'it sends nothing through Resend here'
  }
  for (const site of sites) {
    const where = `${site.file}:${site.line}`
    if (site.analysis.kind !== 'template') {
      return `the send at ${where} is ${site.analysis.kind === 'mixed' ? 'a mixed batch' : `a ${site.analysis.kind} send`}, not a template`
    }
    for (const message of site.analysis.messages) {
      if (message.unsupported.length > 0) {
        return `the send at ${where} uses ${message.unsupported.join(', ')}, which Brew app email does not take`
      }
      if (message.templateId === null && !allTemplatesMigrated) {
        return `the send at ${where} computes its template id, and not every template migrated`
      }
      if (
        message.templateId !== null &&
        !knownTemplates.has(message.templateId)
      ) {
        return `the send at ${where} uses template ${message.templateId}, which has no Brew key yet`
      }
    }
  }
  // The Brew client has emails.send and batch.send only: a client also
  // used for anything else (contacts, emails.get) stays on Resend.
  for (const client of clients) {
    const uses = [
      ...(client.binding === null ? [] : [{ file, name: client.binding }]),
      ...[...scan.files].flatMap(([other, { locations }]) =>
        locations.localImports
          .filter((entry) => entry.imported === client.exportName)
          .map((entry) => ({ file: other, name: entry.local }))
      ),
    ]
    const literal = (text: string) =>
      text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const other = uses.find(({ file: user, name: local }) =>
      new RegExp(
        `(?<![\\w$.])${literal(local)}\\s*\\??\\.\\s*(?!(?:emails|batch)\\s*\\??\\.\\s*send\\b)[A-Za-z_$]`
      ).test(scan.files.get(user)?.text ?? '')
    )
    if (other !== undefined) {
      return `${other.file} uses the client for more than emails.send and batch.send, which the Brew client does not provide`
    }
  }
  for (const client of clients) {
    const args = scanned.text.slice(
      client.site.args.start,
      client.site.args.end
    )
    if (keyArgument(args) === null) {
      return `the client at ${file}:${client.line} reads its key from somewhere other than RESEND_API_KEY; point it at your Brew key by hand`
    }
  }
  return null
}

/**
 * The Brew key expression for a client's arguments: `RESEND_API_KEY`
 * renamed to `BREW_API_KEY`, or `process.env.BREW_API_KEY` when the client
 * took none; null when the key comes from somewhere else.
 */
export function keyArgument(args: string): string | null {
  const trimmed = args.trim()
  if (trimmed === '') {
    return 'process.env.BREW_API_KEY'
  }
  if (/,/.test(trimmed.replace(/\([^()]*\)/g, ''))) {
    return null
  }
  return /\bRESEND_API_KEY\b/.test(trimmed)
    ? trimmed.replace(/\bRESEND_API_KEY\b/g, 'BREW_API_KEY')
    : null
}

/**
 * The map's specifier from `fromFile`. A JavaScript map is named with its
 * extension (Node ESM resolves no other); a TypeScript map as the file's
 * other relative imports name theirs.
 */
function relativeSpecifier(
  fromFile: string,
  target: string,
  useJs: boolean
): string {
  const typescript = target.endsWith('.ts')
  let path = relative(
    dirname(fromFile),
    typescript ? target.slice(0, -3) : target
  )
    .split(sep)
    .join('/')
  if (!path.startsWith('.')) {
    path = `./${path}`
  }
  return typescript && useJs ? `${path}.js` : path
}

/** The rewritten text of a file `decideRewrites` cleared. */
export function rewriteFile(input: {
  readonly file: string
  readonly scanned: ScannedFile
  readonly mapFile: string
}): string {
  const { text, locations } = input.scanned
  const edits: Array<{ start: number; end: number; replacement: string }> = []
  for (const entry of locations.imports) {
    if (entry.typeOnly) {
      continue
    }
    const quote = text[entry.specifier.start] ?? "'"
    edits.push({
      start: entry.specifier.start,
      end: entry.specifier.end,
      replacement: `${quote}${ADAPTER_MODULE}${quote}`,
    })
  }
  const specifier = relativeSpecifier(
    input.file,
    input.mapFile,
    locations.relativeImportsUseJs
  )
  const quote = text[locations.imports[0]?.specifier.start ?? -1] ?? "'"
  const esm = locations.moduleSyntax === 'esm'
  // CommonJS reads the map where the client is built, so no statement
  // order (`require` and `new` on one line) can reach it undeclared.
  const templates = esm
    ? MAP_EXPORT
    : `require(${quote}${specifier}${quote}).${MAP_EXPORT}`
  for (const client of locations.clients) {
    const args = text.slice(client.args.start, client.args.end)
    const key = keyArgument(args) ?? 'process.env.BREW_API_KEY'
    const replacement = `${key}, { templates: ${templates} }`
    if (
      client.args.start === client.args.end &&
      text[client.args.start] !== ')'
    ) {
      // `new Resend` without parentheses.
      edits.push({
        start: client.args.start,
        end: client.args.end,
        replacement: `(${replacement})`,
      })
    } else {
      edits.push({
        start: client.args.start,
        end: client.args.end,
        replacement,
      })
    }
  }
  if (esm && locations.clients.length > 0) {
    const at = locations.importInsertAt
    // Its own line: code after the last import on that line stays apart.
    const lineBreak = /[\r\n]/.test(text[at] ?? '\n') ? '' : '\n'
    edits.push({
      start: at,
      end: at,
      replacement: `${at === 0 ? '' : '\n'}import { ${MAP_EXPORT} } from ${quote}${specifier}${quote}${lineBreak}`,
    })
  }
  edits.sort((a, b) => b.start - a.start)
  let out = text
  for (const edit of edits) {
    out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end)
  }
  return out
}

/** `lib/brew-resend-map.ts`: Resend template id and alias → Brew key. */
export function mapFileContent(input: {
  readonly entries: ReadonlyArray<readonly [string, string]>
  readonly typescript: boolean
  readonly moduleSyntax: 'esm' | 'cjs'
  readonly rerunCommand: string
}): string {
  const lines = input.entries.map(
    ([id, key]) => `  ${JSON.stringify(id)}: ${JSON.stringify(key)},`
  )
  const header = [
    '/**',
    ' * Resend template id (and alias) → Brew trigger key, written by',
    ` * \`${input.rerunCommand}\`. \`new Resend(key, { templates })\` from`,
    ` * \`${ADAPTER_MODULE}\` sends each template by its key. Re-run the`,
    ' * migration to refresh this file.',
    ' */',
  ]
  if (input.moduleSyntax === 'cjs' && !input.typescript) {
    return [...header, `exports.${MAP_EXPORT} = {`, ...lines, '}', ''].join(
      '\n'
    )
  }
  return [
    ...header,
    input.typescript
      ? `export const ${MAP_EXPORT}: Readonly<Record<string, string>> = {`
      : `export const ${MAP_EXPORT} = {`,
    ...lines,
    '}',
    '',
  ].join('\n')
}

/** Project-relative POSIX path of `file` joined to the root. */
export function absoluteIn(root: string, file: string): string {
  return join(root, ...file.split('/'))
}
