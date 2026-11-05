import { relative, sep } from 'node:path'
import { resolveAuth } from '../../lib/client'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import { flagString } from '../../lib/input'
import {
  codexLoginCommand,
  codexTomlBlock,
  configDocument,
  configTarget,
  containerKey,
  deeplinkFor,
  detectMcpClients,
  isMcpClientId,
  MCP_CLIENT_IDS,
  MCP_CLIENT_LABELS,
  MCP_SERVER_NAME,
  type McpAuthMode,
  type McpClientId,
  type McpScope,
  mcpUrlFromApiUrl,
  serverEntry,
  USER_SCOPE_ONLY,
} from '../../lib/mcp-clients'
import {
  type PlannedChange,
  ProjectWriter,
  stripBom,
  UTF8_BOM,
} from '../../lib/project/fs-writer'
import { resolveProjectRootWithGit } from '../../lib/project/monorepo'
import {
  resolveCwd,
  resolveHomeDir,
  resolveSpawn,
} from '../../lib/project/process'

export type McpInstallAction =
  | 'created'
  | 'updated'
  | 'unchanged'
  | 'manual'
  | 'printed'

export type McpInstallResult = {
  readonly client: McpClientId
  /** Project-relative for project files, absolute for user files. */
  readonly path?: string
  readonly action: McpInstallAction
  /** One-click install link (Cursor, VS Code). */
  readonly deeplink?: string
  /** What to paste (or run) by hand: `manual` and `printed` results. */
  readonly snippet?: string
  /** Why a result is `manual`. */
  readonly note?: string
  /** A command to run once the entry is in place (Codex OAuth sign-in). */
  readonly nextStep?: string
}

const CLIENT_LIST = `${MCP_CLIENT_IDS.join(', ')}, all`

export const mcpInstallCommand = defineCommand({
  path: ['mcp', 'install'],
  summary:
    "Add the Brew MCP server to your AI editors' config (Cursor, VS Code, Claude Code, Gemini CLI, Devin Desktop/Windsurf, Codex)",
  sdkMethod: null,
  commandClass: 'write',
  flags: [
    {
      flag: '--client <ids...>',
      summary: `Clients to configure: ${CLIENT_LIST} (default: the ones this project uses; windsurf (Devin Desktop) and codex only when named)`,
    },
    {
      flag: '--scope <scope>',
      summary: 'project (files in this repo) or user (your home directory)',
      defaultValue: 'project',
    },
    {
      flag: '--auth <mode>',
      summary:
        'oauth (URL only; sign in from the client) or env (a header the client fills from BREW_API_KEY; never a literal key)',
      defaultValue: 'oauth',
    },
    {
      flag: '--print',
      summary: 'Print each config snippet instead of writing files',
    },
    {
      flag: '--dry-run',
      summary: 'Report what would change without writing anything',
    },
  ],
  examples: [
    'brew-cli mcp install',
    'brew-cli mcp install --client cursor claude-code',
    'brew-cli mcp install --client codex --auth env',
    'brew-cli mcp install --client all --dry-run --json',
    'brew-cli mcp install --client vscode --print',
  ],
  run: async ({ ctx, flags }) => {
    const scope = parseScope(flags.scope)
    const auth = parseAuth(flags.auth)
    const isPrint = flags.print === true
    const isDryRun = flags.dryRun === true
    const resolved = await resolveProjectRootWithGit(
      resolveCwd(ctx.io),
      resolveSpawn(ctx.io),
      ctx.signal
    )
    const projectRoot = resolved.monorepo?.root ?? resolved.root
    const env = ctx.io.env
    const home = resolveHomeDir(env)
    const mcpUrl = mcpUrlFromApiUrl(
      resolveAuth({ globals: ctx.globals, env, allowAnonymous: true }).apiUrl
    )

    const requested = parseClients(flags.client)
    const detected = detectMcpClients(projectRoot, env)
    let clients: readonly McpClientId[]
    // Detected Windsurf/Codex are reported, never written: their config is
    // in the home directory, so writing it takes an explicit --client.
    let reportOnly = new Set<McpClientId>()
    if (requested !== undefined) {
      clients = requested
    } else if (detected.length > 0) {
      clients = detected
      reportOnly = new Set(detected.filter((id) => USER_SCOPE_ONLY.has(id)))
    } else if (isPrint) {
      clients = MCP_CLIENT_IDS
    } else {
      throw new CliUsageError(
        `No MCP client detected in ${projectRoot} (.cursor/, .vscode/, .claude/, .gemini/, .windsurf/ or .devin/, .codex/). Pass --client with any of: ${CLIENT_LIST}.`
      )
    }

    const writer = new ProjectWriter({ root: projectRoot, dryRun: isDryRun })
    const results = clients.map((client) =>
      installOne({
        client,
        scope,
        auth,
        mcpUrl,
        projectRoot,
        home,
        env,
        writer,
        mode: isPrint ? 'print' : reportOnly.has(client) ? 'report' : 'write',
      })
    )
    return {
      data: { mcpUrl, dryRun: isDryRun, clients: results },
      human: renderHuman(results, { isDryRun, mcpUrl }),
    }
  },
})

function installOne(input: {
  readonly client: McpClientId
  readonly scope: McpScope
  readonly auth: McpAuthMode
  readonly mcpUrl: string
  readonly projectRoot: string
  readonly home: string
  readonly env: Readonly<Record<string, string | undefined>>
  readonly writer: ProjectWriter
  readonly mode: 'write' | 'print' | 'report'
}): McpInstallResult {
  const { client, auth, mcpUrl, writer } = input
  const deeplink = deeplinkFor(client, mcpUrl, auth)
  const withLink = {
    ...(deeplink === undefined ? {} : { deeplink }),
    // Codex signs in to an OAuth server only through its own command.
    ...(client === 'codex' && auth === 'oauth'
      ? { nextStep: codexLoginCommand() }
      : {}),
  }
  const target = configTarget(client, input.scope, {
    projectRoot: input.projectRoot,
    home: input.home,
    env: input.env,
    url: mcpUrl,
    auth,
  })
  if (target.kind === 'command') {
    return {
      client,
      action: input.mode === 'print' ? 'printed' : 'manual',
      snippet: target.command,
      ...withLink,
      ...(input.mode === 'print'
        ? {}
        : { note: 'Claude Code manages its user config: run this command.' }),
    }
  }
  const path = displayPath(target.path, input.projectRoot)
  const snippet =
    client === 'codex'
      ? codexTomlBlock(mcpUrl, auth)
      : `${JSON.stringify(configDocument(client, mcpUrl, auth), null, 2)}\n`
  if (input.mode === 'print') {
    return { client, path, action: 'printed', snippet, ...withLink }
  }
  if (input.mode === 'report') {
    return {
      client,
      path,
      action: 'manual',
      snippet,
      note: `Detected, not written: its config is in your home directory. Re-run with --client ${client} to write it.`,
    }
  }
  const outcome =
    client === 'codex'
      ? installCodex(writer, target.path, target.within, mcpUrl, auth)
      : installJson(writer, target.path, target.within, client, mcpUrl, auth)
  return {
    client,
    path,
    action: outcome.action,
    ...withLink,
    ...(outcome.action === 'manual' ? { snippet } : {}),
    ...(outcome.note === undefined ? {} : { note: outcome.note }),
  }
}

type Outcome = {
  readonly action: 'created' | 'updated' | 'unchanged' | 'manual'
  readonly note?: string
}

function fromWriter(change: PlannedChange): Outcome {
  switch (change.action) {
    case 'created':
    case 'updated':
    case 'unchanged':
      return { action: change.action }
    case 'refused':
      return {
        action: 'manual',
        note: `Not written: ${change.note ?? 'the path is not safe to write'}. Add this entry by hand.`,
      }
    default:
      return { action: 'manual', note: 'The file could not be updated safely.' }
  }
}

/** A different `brew` entry is the user's: never replaced silently. */
const CUSTOMISED_NOTE = `A ${MCP_SERVER_NAME} entry with other settings is already there and was left as it is. Edit it to match this snippet if you want these settings.`

function installJson(
  writer: ProjectWriter,
  path: string,
  within: string,
  client: Exclude<McpClientId, 'codex'>,
  url: string,
  auth: McpAuthMode
): Outcome {
  const existing = writer.read(path)
  if (existing === null || existing.trim() === '') {
    const text = `${JSON.stringify(configDocument(client, url, auth), null, 2)}\n`
    return fromWriter(
      writer.writeFile(path, text, { overwrite: existing !== null, within })
    )
  }
  // A byte order mark (some Windows editors write one) is kept, not parsed.
  const bom = existing.startsWith(UTF8_BOM) ? UTF8_BOM : ''
  const body = stripBom(existing)
  let root: unknown
  try {
    root = JSON.parse(body)
  } catch {
    return {
      action: 'manual',
      note:
        parseJsonc(body) === undefined
          ? 'Not valid JSON: fix the file, then add this entry.'
          : 'Has comments, which a rewrite would drop: add this entry by hand.',
    }
  }
  if (!isRecord(root)) {
    return {
      action: 'manual',
      note: 'The file is not a JSON object: add this entry by hand.',
    }
  }
  const key = containerKey(client)
  const container = root[key]
  if (container !== undefined && !isRecord(container)) {
    return {
      action: 'manual',
      note: `"${key}" is not an object: add this entry by hand.`,
    }
  }
  const entry = serverEntry(client, url, auth)
  if (container !== undefined && Object.hasOwn(container, MCP_SERVER_NAME)) {
    return deepEqual(container[MCP_SERVER_NAME], entry)
      ? { action: 'unchanged' }
      : { action: 'manual', note: CUSTOMISED_NOTE }
  }
  // Every other server and setting stays, in its original order.
  const merged = {
    ...root,
    [key]: { ...(container ?? {}), [MCP_SERVER_NAME]: entry },
  }
  const text = `${bom}${JSON.stringify(merged, null, detectIndent(body))}\n`
  return fromWriter(writer.writeFile(path, text, { overwrite: true, within }))
}

/**
 * TOML with comments removed and string VALUES blanked (newlines kept, so
 * line numbers still match): what is left is keys, headers and
 * punctuation. Quoted keys stay — a string before `=`, or one followed by
 * `=` / `.` / `]`, is a key. A value context opened by `[` or `{` after
 * `=` spans lines until it closes.
 */
export function tomlStructure(text: string): string {
  let out = ''
  let isValue = false
  let depth = 0
  let index = 0
  while (index < text.length) {
    const char = text[index] ?? ''
    if (char === '\n') {
      out += char
      isValue = depth > 0
      index += 1
      continue
    }
    if (char === '#') {
      while (index < text.length && text[index] !== '\n') {
        index += 1
      }
      continue
    }
    if (char === '"' || char === "'") {
      const delimiter = text.startsWith(char.repeat(3), index)
        ? char.repeat(3)
        : char
      let end = index + delimiter.length
      while (end < text.length && !text.startsWith(delimiter, end)) {
        if (char === '"' && text[end] === '\\') {
          end += 1
        } else if (delimiter.length === 1 && text[end] === '\n') {
          break
        }
        end += 1
      }
      end = Math.min(text.length, end + delimiter.length)
      const literal = text.slice(index, end)
      // A value string is followed by `,` `]` `}` or the line's end; a key
      // (an inline table's, or a dotted one) by `=` or `.`.
      const isKey = !isValue || /^[ \t]*[=.]/.test(text.slice(end, end + 64))
      out += isKey ? literal : literal.replace(/[^\n]/g, ' ')
      index = end
      continue
    }
    if (char === '=') {
      isValue = true
    } else if (isValue && (char === '[' || char === '{')) {
      depth += 1
    } else if (isValue && depth > 0 && (char === ']' || char === '}')) {
      depth -= 1
    }
    out += char
    index += 1
  }
  return out
}

/** One definition in a TOML file, by its full dotted key. */
export type TomlDefinition = {
  /** `[table]`, `[[array-of-tables]]`, or a `key = value` line. */
  readonly kind: 'table' | 'array-table' | 'key'
  /** The full key: the enclosing table's path, then the key's own. */
  readonly path: readonly string[]
  /** The `[table]` the definition sits under (`[]` = the root). */
  readonly table: readonly string[]
  /** Its 0-based line number. */
  readonly line: number
}

/**
 * The tables and keys a TOML file defines, read from `tomlStructure` text
 * (comments gone, string values blanked, so brackets that are left are
 * structure). `null` when a line is neither a header nor `key = value`:
 * TOML this reader does not understand, so nothing may be appended.
 */
export function tomlDefinitions(structure: string): TomlDefinition[] | null {
  const definitions: TomlDefinition[] = []
  let table: readonly string[] = []
  let depth = 0
  const lines = structure.split('\n')
  for (const [line, text] of lines.entries()) {
    if (depth > 0) {
      depth += bracketDepth(text)
      continue
    }
    const trimmed = text.trim()
    if (trimmed === '') {
      continue
    }
    if (trimmed.startsWith('[')) {
      const isArray = trimmed.startsWith('[[')
      const key = parseTomlKey(trimmed, isArray ? 2 : 1)
      const close = isArray ? ']]' : ']'
      if (key === null || trimmed.slice(key.end).trim() !== close) {
        return null
      }
      table = key.segments
      definitions.push({
        kind: isArray ? 'array-table' : 'table',
        path: table,
        table: [],
        line,
      })
      continue
    }
    const key = parseTomlKey(trimmed, 0)
    if (key === null || trimmed[key.end] !== '=') {
      return null
    }
    definitions.push({
      kind: 'key',
      path: [...table, ...key.segments],
      table,
      line,
    })
    depth = Math.max(0, bracketDepth(trimmed.slice(key.end + 1)))
  }
  return definitions
}

/**
 * Net `[`/`{` minus `]`/`}` on a structure line. Values are blanked there;
 * the quoted text left is keys, skipped so a bracket in a key never counts.
 */
function bracketDepth(text: string): number {
  let depth = 0
  let quote: string | null = null
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quote !== null) {
      if (quote === '"' && char === '\\') {
        index += 1
      } else if (char === quote) {
        quote = null
      }
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '[' || char === '{') {
      depth += 1
    } else if (char === ']' || char === '}') {
      depth -= 1
    }
  }
  return depth
}

/**
 * A dotted TOML key starting at `start`: bare, "basic" or 'literal'
 * segments joined by dots. Returns the segments and the index after the
 * key (and the whitespace after it), or `null` when there is none.
 */
function parseTomlKey(
  text: string,
  start: number
): { readonly segments: string[]; readonly end: number } | null {
  const segments: string[] = []
  let index = start
  const skipSpace = (): void => {
    while (text[index] === ' ' || text[index] === '\t') {
      index += 1
    }
  }
  for (;;) {
    skipSpace()
    const char = text[index]
    if (char === '"' || char === "'") {
      let end = index + 1
      let value = ''
      while (end < text.length && text[end] !== char) {
        if (char === '"' && text[end] === '\\') {
          value += text[end + 1] ?? ''
          end += 2
          continue
        }
        value += text[end]
        end += 1
      }
      if (end >= text.length) {
        return null
      }
      segments.push(value)
      index = end + 1
    } else {
      const bare = /^[A-Za-z0-9_-]+/.exec(text.slice(index))
      if (bare === null) {
        return null
      }
      segments.push(bare[0])
      index += bare[0].length
    }
    skipSpace()
    if (text[index] !== '.') {
      return { segments, end: index }
    }
    index += 1
  }
}

const startsWith = (
  path: readonly string[],
  prefix: readonly string[]
): boolean => prefix.every((segment, index) => path[index] === segment)

const sameKey = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && startsWith(a, b)

function installCodex(
  writer: ProjectWriter,
  path: string,
  within: string,
  url: string,
  auth: McpAuthMode
): Outcome {
  const block = codexTomlBlock(url, auth)
  const existing = writer.read(path)
  if (existing === null) {
    return fromWriter(writer.writeFile(path, block, { within }))
  }
  const normalized = existing.replaceAll('\r\n', '\n')
  const lines = normalized.split('\n')
  // Comments and string values hidden: only real TOML structure counts.
  const definitions = tomlDefinitions(tomlStructure(normalized))
  if (definitions === null) {
    return {
      action: 'manual',
      note: 'The file has TOML this command cannot check safely: add this table by hand.',
    }
  }
  const servers = ['mcp_servers']
  const brew = [...servers, MCP_SERVER_NAME]
  const brewTables = definitions.filter(
    (definition) =>
      definition.kind === 'table' && sameKey(definition.path, brew)
  )
  const blocksAppend = definitions.some(
    (definition) =>
      // `mcp_servers = { … }` (an inline table cannot be extended),
      // `[[mcp_servers]]` (not a map of servers).
      (definition.kind === 'key' && sameKey(definition.path, servers)) ||
      (definition.kind === 'array-table' &&
        startsWith(definition.path, servers)) ||
      // brew defined any way but its own `[mcp_servers.brew]` table: a
      // `brew = {…}` or `brew.url = …` key, a dotted key elsewhere, a
      // `[mcp_servers.brew.env]` sub-table.
      (startsWith(definition.path, brew) &&
        !(definition.kind === 'table' && sameKey(definition.path, brew)) &&
        !(definition.kind === 'key' && sameKey(definition.table, brew)))
  )
  const [table] = brewTables
  if (table !== undefined && !blocksAppend && brewTables.length === 1) {
    const body = definitions
      .filter(
        (definition) =>
          definition.kind === 'key' && sameKey(definition.table, brew)
      )
      .map((definition) =>
        (lines[definition.line] ?? '')
          .replace(/\s+#.*$/, '')
          .trim()
          .replace(/\s*=\s*/, ' = ')
      )
    const wanted = block
      .trim()
      .split('\n')
      .slice(1)
      .map((line) => line.trim())
    const isSame =
      body.length === wanted.length &&
      wanted.every((line) => body.includes(line))
    return isSame
      ? { action: 'unchanged' }
      : {
          action: 'manual',
          note: `A [mcp_servers.${MCP_SERVER_NAME}] table with other settings exists and was left as it is. Edit it to match this snippet if you want these settings.`,
        }
  }
  if (table !== undefined || blocksAppend) {
    return {
      action: 'manual',
      note: `mcp_servers or ${MCP_SERVER_NAME} is already defined in a form this command does not edit: check it by hand.`,
    }
  }
  const separator =
    normalized === '' || normalized.endsWith('\n\n')
      ? ''
      : normalized.endsWith('\n')
        ? '\n'
        : '\n\n'
  return fromWriter(
    writer.writeFile(path, `${normalized}${separator}${block}`, {
      overwrite: true,
      within,
    })
  )
}

function parseClients(value: unknown): McpClientId[] | undefined {
  if (value === undefined) {
    return undefined
  }
  const tokens = (Array.isArray(value) ? value : [value])
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item !== '')
  if (tokens.length === 0) {
    throw new CliUsageError(`--client needs at least one of: ${CLIENT_LIST}.`)
  }
  const clients = new Set<McpClientId>()
  for (const token of tokens) {
    if (token === 'all') {
      for (const id of MCP_CLIENT_IDS) {
        clients.add(id)
      }
    } else if (isMcpClientId(token)) {
      clients.add(token)
    } else {
      throw new CliUsageError(
        `Unknown MCP client "${token}". Expected: ${CLIENT_LIST}.`
      )
    }
  }
  // Stable output order, whatever order the flags came in.
  return MCP_CLIENT_IDS.filter((id) => clients.has(id))
}

function parseScope(value: unknown): McpScope {
  const scope = flagString(value) ?? 'project'
  if (scope !== 'project' && scope !== 'user') {
    throw new CliUsageError('--scope must be project or user.')
  }
  return scope
}

function parseAuth(value: unknown): McpAuthMode {
  const auth = flagString(value) ?? 'oauth'
  if (auth !== 'oauth' && auth !== 'env') {
    throw new CliUsageError('--auth must be oauth or env.')
  }
  return auth
}

function displayPath(absolute: string, projectRoot: string): string {
  const rel = relative(projectRoot, absolute)
  return rel.startsWith('..') || rel === '' || /^[A-Za-z]:/.test(rel)
    ? absolute
    : rel.split(sep).join('/')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]))
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a)
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => deepEqual(a[key], b[key]))
    )
  }
  return false
}

/** The file's own indentation (a tab, or its first indent's width). */
function detectIndent(text: string): string | number {
  const match = /^([ \t]+)\S/m.exec(text)
  const indent = match?.[1]
  if (indent === undefined) {
    return 2
  }
  return indent.startsWith('\t') ? '\t' : indent.length
}

/**
 * JSON with comments and trailing commas (VS Code and Gemini accept it),
 * parsed only to tell "has comments" from "broken". `undefined` = neither.
 */
export function parseJsonc(text: string): unknown {
  let out = ''
  let inString = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (inString) {
      out += char
      if (char === '\\') {
        out += next ?? ''
        index += 1
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
      out += char
    } else if (char === '/' && next === '/') {
      while (index < text.length && text[index] !== '\n') {
        index += 1
      }
      out += '\n'
    } else if (char === '/' && next === '*') {
      const end = text.indexOf('*/', index + 2)
      index = end === -1 ? text.length : end + 1
    } else {
      out += char
    }
  }
  try {
    return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1')) as unknown
  } catch {
    return undefined
  }
}

function renderHuman(
  results: readonly McpInstallResult[],
  options: { readonly isDryRun: boolean; readonly mcpUrl: string }
): string {
  const lines: string[] = []
  if (options.isDryRun) {
    lines.push('Dry run: nothing was written.')
  }
  lines.push(`Brew MCP server: ${options.mcpUrl}`)
  const width = Math.max(...results.map((result) => result.action.length))
  for (const result of results) {
    const label = MCP_CLIENT_LABELS[result.client]
    lines.push(
      `${result.action.padEnd(width)}  ${label}${result.path === undefined ? '' : ` (${result.path})`}`
    )
    if (result.note !== undefined) {
      lines.push(`  ${result.note}`)
    }
    if (result.snippet !== undefined) {
      for (const line of result.snippet.trimEnd().split('\n')) {
        lines.push(`    ${line}`)
      }
    }
    if (result.deeplink !== undefined) {
      lines.push(`  One-click install: ${result.deeplink}`)
    }
    if (result.nextStep !== undefined) {
      lines.push(`  Then sign in: ${result.nextStep}`)
    }
  }
  return lines.join('\n')
}
