import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

/**
 * Where each MCP client keeps its server list, and the Brew entry it needs.
 * Pure data and builders: `mcp install` does the file work.
 *
 * Auth modes: `oauth` writes the URL only (the client runs Brew's OAuth
 * flow on first use); `env` adds an `Authorization` header that the CLIENT
 * expands from `BREW_API_KEY` at connect time, in each client's own
 * interpolation syntax. A literal key is never written anywhere.
 */

export const MCP_CLIENT_IDS = [
  'cursor',
  'vscode',
  'claude-code',
  'gemini',
  'windsurf',
  'codex',
] as const

export type McpClientId = (typeof MCP_CLIENT_IDS)[number]
export type McpAuthMode = 'oauth' | 'env'
export type McpScope = 'project' | 'user'

export const MCP_SERVER_NAME = 'brew'
export const MCP_API_KEY_ENV = 'BREW_API_KEY'
export const DEFAULT_MCP_URL = 'https://brew.new/api/mcp'

export const MCP_CLIENT_LABELS: Readonly<Record<McpClientId, string>> = {
  cursor: 'Cursor',
  vscode: 'VS Code',
  'claude-code': 'Claude Code',
  gemini: 'Gemini CLI',
  windsurf: 'Devin Desktop (Windsurf)',
  codex: 'Codex',
}

/** Clients whose only config lives in the user's home directory. */
export const USER_SCOPE_ONLY: ReadonlySet<McpClientId> = new Set([
  'windsurf',
  'codex',
])

export function isMcpClientId(value: string): value is McpClientId {
  return (MCP_CLIENT_IDS as readonly string[]).includes(value)
}

/** The MCP endpoint beside an API base URL: its origin + `/api/mcp`. */
export function mcpUrlFromApiUrl(apiUrl: string): string {
  return `${new URL(apiUrl).origin}/api/mcp`
}

/**
 * `Authorization` in the client's own env-interpolation syntax. Cursor,
 * VS Code and Devin Desktop expand `${env:NAME}` (VS Code resolves every
 * predefined variable, `env:` included, across the whole server entry);
 * Claude Code and Gemini CLI expand `${NAME}`. Each reads the environment
 * the client itself was started with.
 */
function authHeader(client: McpClientId): string {
  switch (client) {
    case 'cursor':
    case 'vscode':
    case 'windsurf':
      return `Bearer \${env:${MCP_API_KEY_ENV}}`
    default:
      return `Bearer \${${MCP_API_KEY_ENV}}`
  }
}

/** The JSON clients' container key for their server map. */
export function containerKey(
  client: Exclude<McpClientId, 'codex'>
): 'mcpServers' | 'servers' {
  return client === 'vscode' ? 'servers' : 'mcpServers'
}

/** The `brew` server entry for a JSON-configured client. */
export function serverEntry(
  client: Exclude<McpClientId, 'codex'>,
  url: string,
  auth: McpAuthMode
): Record<string, unknown> {
  const headers =
    auth === 'env' ? { headers: { Authorization: authHeader(client) } } : {}
  switch (client) {
    // Devin Desktop (`windsurf`): both its agents read `url` from the same
    // file (legacy Cascade also takes `serverUrl`; Devin Local only `url`).
    case 'cursor':
    case 'windsurf':
      return { url, ...headers }
    case 'vscode':
    case 'claude-code':
      return { type: 'http', url, ...headers }
    case 'gemini':
      return { httpUrl: url, ...headers }
  }
}

/** A whole config file holding only the Brew entry (new files, snippets). */
export function configDocument(
  client: Exclude<McpClientId, 'codex'>,
  url: string,
  auth: McpAuthMode
): Record<string, unknown> {
  return {
    [containerKey(client)]: {
      [MCP_SERVER_NAME]: serverEntry(client, url, auth),
    },
  }
}

/** Codex's `[mcp_servers.brew]` table (streamable HTTP). */
export function codexTomlBlock(url: string, auth: McpAuthMode): string {
  const lines = [
    `[mcp_servers.${MCP_SERVER_NAME}]`,
    `url = ${JSON.stringify(url)}`,
  ]
  if (auth === 'env') {
    lines.push(`bearer_token_env_var = ${JSON.stringify(MCP_API_KEY_ENV)}`)
  }
  return `${lines.join('\n')}\n`
}

/**
 * Claude Code's own command for a user-scope server (it owns ~/.claude.json).
 * `--header` is variadic (`-H, --header <header...>`), so it comes after the
 * name and URL: before them it would swallow both.
 */
export function claudeMcpAddCommand(url: string, auth: McpAuthMode): string {
  const header =
    auth === 'env'
      ? ` --header 'Authorization: ${authHeader('claude-code')}'`
      : ''
  return `claude mcp add --transport http --scope user ${MCP_SERVER_NAME} ${url}${header}`
}

/** What Codex needs after an OAuth entry is written: its own login. */
export function codexLoginCommand(): string {
  return `codex mcp login ${MCP_SERVER_NAME}`
}

/**
 * Cursor's one-click install link. Byte-compatible with brew-v2
 * `lib/mcp/handoff.ts#buildCursorInstallUrl`: `config` is the entry's JSON
 * as unpadded base64url, passed raw (not percent-encoded).
 */
export function buildCursorInstallUrl(
  url: string = DEFAULT_MCP_URL,
  auth: McpAuthMode = 'oauth'
): string {
  const json = JSON.stringify(serverEntry('cursor', url, auth))
  const base64url = Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/[=]+$/, '')
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${MCP_SERVER_NAME}&config=${base64url}`
}

/** VS Code's one-click install link (`vscode:mcp/install?<json>`). */
export function buildVsCodeInstallUrl(
  url: string = DEFAULT_MCP_URL,
  auth: McpAuthMode = 'oauth'
): string {
  const config = { name: MCP_SERVER_NAME, ...serverEntry('vscode', url, auth) }
  return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`
}

export function deeplinkFor(
  client: McpClientId,
  url: string,
  auth: McpAuthMode
): string | undefined {
  if (client === 'cursor') {
    return buildCursorInstallUrl(url, auth)
  }
  if (client === 'vscode') {
    return buildVsCodeInstallUrl(url, auth)
  }
  return undefined
}

/** VS Code's user profile directory (where its user `mcp.json` lives). */
export function vscodeUserDir(
  home: string,
  env: Readonly<Record<string, string | undefined>>,
  platform: NodeJS.Platform = process.platform
): string {
  if (platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'Code', 'User')
  }
  if (platform === 'win32') {
    const appData = env.APPDATA
    return join(
      appData !== undefined && appData !== ''
        ? appData
        : join(home, 'AppData', 'Roaming'),
      'Code',
      'User'
    )
  }
  const xdg = env.XDG_CONFIG_HOME
  return join(
    xdg !== undefined && xdg !== '' ? xdg : join(home, '.config'),
    'Code',
    'User'
  )
}

/**
 * Devin Desktop's (formerly Windsurf) config directory, per
 * docs.devin.ai/desktop/cascade/mcp: `$XDG_CONFIG_HOME/devin` or
 * `~/.config/devin` on macOS and Linux, `%APPDATA%\devin` on Windows. Its
 * legacy Cascade agent and its default Devin Local agent read the same
 * `mcp_config.json` there.
 */
export function devinConfigDir(
  home: string,
  env: Readonly<Record<string, string | undefined>>,
  platform: NodeJS.Platform = process.platform
): string {
  if (platform === 'win32') {
    const appData = env.APPDATA
    return join(
      appData !== undefined && appData !== ''
        ? appData
        : join(home, 'AppData', 'Roaming'),
      'devin'
    )
  }
  const xdg = env.XDG_CONFIG_HOME
  return join(
    xdg !== undefined && xdg !== '' ? xdg : join(home, '.config'),
    'devin'
  )
}

export type ConfigTarget =
  | {
      readonly kind: 'file'
      /** Absolute path. */
      readonly path: string
      readonly scope: McpScope
      /**
       * The directory the write must land in once symbolic links are
       * resolved: the project root, or the home directory (the client's own
       * config directory when it lives elsewhere, e.g. `$CODEX_HOME`).
       */
      readonly within: string
    }
  /** No file this CLI should edit: print the client's own command. */
  | { readonly kind: 'command'; readonly command: string }

/**
 * Where a client's Brew entry goes. Devin Desktop (Windsurf) and Codex
 * only have a user config, whatever `scope` says.
 */
export function configTarget(
  client: McpClientId,
  scope: McpScope,
  input: {
    readonly projectRoot: string
    readonly home: string
    readonly env: Readonly<Record<string, string | undefined>>
    readonly url: string
    readonly auth: McpAuthMode
    readonly platform?: NodeJS.Platform
  }
): ConfigTarget {
  const { projectRoot, home, env } = input
  const user = (path: string): ConfigTarget => ({
    kind: 'file',
    path,
    scope: 'user',
    within: isInsideDir(path, home) ? home : dirname(path),
  })
  const project = (path: string): ConfigTarget => ({
    kind: 'file',
    path: join(projectRoot, path),
    scope: 'project',
    within: projectRoot,
  })
  switch (client) {
    case 'windsurf':
      return user(
        join(devinConfigDir(home, env, input.platform), 'mcp_config.json')
      )
    case 'codex': {
      const codexHome = env.CODEX_HOME
      return user(
        join(
          codexHome !== undefined && codexHome !== ''
            ? codexHome
            : join(home, '.codex'),
          'config.toml'
        )
      )
    }
    case 'cursor':
      return scope === 'user'
        ? user(join(home, '.cursor', 'mcp.json'))
        : project(join('.cursor', 'mcp.json'))
    case 'vscode':
      return scope === 'user'
        ? user(join(vscodeUserDir(home, env, input.platform), 'mcp.json'))
        : project(join('.vscode', 'mcp.json'))
    case 'claude-code':
      return scope === 'user'
        ? {
            kind: 'command',
            command: claudeMcpAddCommand(input.url, input.auth),
          }
        : project('.mcp.json')
    case 'gemini':
      return scope === 'user'
        ? user(join(home, '.gemini', 'settings.json'))
        : project(join('.gemini', 'settings.json'))
  }
}

function isInsideDir(path: string, dir: string): boolean {
  const rel = relative(resolve(dir), resolve(path))
  return (
    rel !== '' &&
    rel !== '..' &&
    !rel.startsWith(`..${sep}`) &&
    !isAbsolute(rel)
  )
}

/**
 * The clients this project (or the agent running us) already uses: their
 * config directories in the project root (`.windsurf/` or Devin's
 * `.devin/` for Devin Desktop), Claude Code's `CLAUDECODE=1`, Codex's
 * `CODEX_*` environment.
 */
export function detectMcpClients(
  projectRoot: string,
  env: Readonly<Record<string, string | undefined>>
): McpClientId[] {
  const has = (dir: string): boolean => existsSync(join(projectRoot, dir))
  const detected: McpClientId[] = []
  if (has('.cursor')) {
    detected.push('cursor')
  }
  if (has('.vscode')) {
    detected.push('vscode')
  }
  if (has('.claude') || env.CLAUDECODE === '1') {
    detected.push('claude-code')
  }
  if (has('.gemini')) {
    detected.push('gemini')
  }
  if (has('.windsurf') || has('.devin')) {
    detected.push('windsurf')
  }
  if (
    has('.codex') ||
    Object.keys(env).some((key) => key.startsWith('CODEX_'))
  ) {
    detected.push('codex')
  }
  return detected
}
