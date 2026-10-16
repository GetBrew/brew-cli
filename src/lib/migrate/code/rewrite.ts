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

/** Where the template map goes, by the project's helper directory and language. */
export function mapFilePath(
  libDir: string | null,
  typescript: boolean
): string {
  return `${libDir ?? 'lib'}/brew-resend-map.${typescript ? 'ts' : 'js'}`
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

function relativeSpecifier(
  fromFile: string,
  target: string,
  useJs: boolean
): string {
  const withoutExtension = target.replace(/\.(?:ts|js)$/, '')
  let path = relative(dirname(fromFile), withoutExtension).split(sep).join('/')
  if (!path.startsWith('.')) {
    path = `./${path}`
  }
  return useJs ? `${path}.js` : path
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
  for (const client of locations.clients) {
    const args = text.slice(client.args.start, client.args.end)
    const key = keyArgument(args) ?? 'process.env.BREW_API_KEY'
    const replacement = `${key}, { templates: ${MAP_EXPORT} }`
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
  if (locations.clients.length > 0) {
    const specifier = relativeSpecifier(
      input.file,
      input.mapFile,
      locations.relativeImportsUseJs
    )
    const quote = text[locations.imports[0]?.specifier.start ?? -1] ?? "'"
    if (locations.moduleSyntax === 'esm') {
      edits.push({
        start: locations.importInsertAt,
        end: locations.importInsertAt,
        replacement: `${locations.importInsertAt === 0 ? '' : '\n'}import { ${MAP_EXPORT} } from ${quote}${specifier}${quote}${locations.importInsertAt === 0 ? '\n' : ''}`,
      })
    } else {
      const requireAt = locations.imports.find(
        (entry) => entry.kind === 'require'
      )
      const lineEnd =
        requireAt === undefined
          ? 0
          : text.indexOf('\n', requireAt.specifier.end)
      const at = lineEnd === -1 ? text.length : lineEnd
      edits.push({
        start: at,
        end: at,
        replacement: `${at === 0 ? '' : '\n'}const { ${MAP_EXPORT} } = require(${quote}${specifier}${quote})${at === 0 ? '\n' : ''}`,
      })
    }
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
