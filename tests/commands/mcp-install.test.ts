import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildCursorInstallUrl,
  buildVsCodeInstallUrl,
  claudeMcpAddCommand,
  configTarget,
  devinConfigDir,
  mcpUrlFromApiUrl,
  vscodeUserDir,
} from '../../src/lib/mcp-clients'
import type { SpawnFn } from '../../src/lib/types'
import { copyFixture, tempProject } from '../helpers/fixtures'
import { runCli } from '../helpers/run-cli'

type Result = {
  client: string
  path?: string
  action: string
  deeplink?: string
  snippet?: string
  note?: string
  nextStep?: string
}
type Output = { mcpUrl: string; dryRun: boolean; clients: Result[] }

/** brew-v2 `buildCursorInstallUrl()` for https://brew.new/api/mcp, verbatim. */
/** What the client expands at connect time (never the key itself). */
const ENV_HEADER = `Bearer \${env:BREW_API_KEY}`
const PLAIN_ENV_HEADER = `Bearer \${BREW_API_KEY}`

const BREW_V2_CURSOR_LINK =
  'cursor://anysphere.cursor-deeplink/mcp/install?name=brew&config=eyJ1cmwiOiJodHRwczovL2JyZXcubmV3L2FwaS9tY3AifQ'

function setup(dirs: readonly string[] = []): {
  root: string
  home: string
  env: Record<string, string>
} {
  const root = tempProject()
  const home = tempProject('brew-cli-home-')
  for (const dir of dirs) {
    mkdirSync(join(root, dir), { recursive: true })
  }
  return {
    root,
    home,
    env: { HOME: home, BREW_CLI_CONFIG_DIR: join(home, '.config/brew-cli') },
  }
}

async function install(
  argv: readonly string[],
  options: {
    root: string
    env: Record<string, string | undefined>
    spawn?: SpawnFn
  }
): Promise<{ code: number; output: Output; stderr: string }> {
  const result = await runCli(['mcp', 'install', ...argv, '--json'], {
    cwd: options.root,
    env: options.env,
    ...(options.spawn === undefined ? {} : { spawn: options.spawn }),
  })
  return {
    code: result.code,
    output: result.json as Output,
    stderr: result.stderr,
  }
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'))
}

describe('mcp install', () => {
  it('writes every detected project client, with deeplinks', async () => {
    const { root, env } = setup(['.cursor', '.vscode', '.claude', '.gemini'])
    const { code, output } = await install([], { root, env })
    expect(code).toBe(0)
    expect(output.mcpUrl).toBe('https://brew.new/api/mcp')
    expect(output.dryRun).toBe(false)
    expect(
      output.clients.map(({ client, path, action }) => ({
        client,
        path,
        action,
      }))
    ).toEqual([
      { client: 'cursor', path: '.cursor/mcp.json', action: 'created' },
      { client: 'vscode', path: '.vscode/mcp.json', action: 'created' },
      { client: 'claude-code', path: '.mcp.json', action: 'created' },
      { client: 'gemini', path: '.gemini/settings.json', action: 'created' },
    ])
    expect(readJson(join(root, '.cursor/mcp.json'))).toEqual({
      mcpServers: { brew: { url: 'https://brew.new/api/mcp' } },
    })
    expect(readJson(join(root, '.vscode/mcp.json'))).toEqual({
      servers: { brew: { type: 'http', url: 'https://brew.new/api/mcp' } },
    })
    expect(readJson(join(root, '.mcp.json'))).toEqual({
      mcpServers: { brew: { type: 'http', url: 'https://brew.new/api/mcp' } },
    })
    expect(readJson(join(root, '.gemini/settings.json'))).toEqual({
      mcpServers: { brew: { httpUrl: 'https://brew.new/api/mcp' } },
    })
    expect(output.clients[0]?.deeplink).toBe(BREW_V2_CURSOR_LINK)
    expect(output.clients[1]?.deeplink).toBe(
      `vscode:mcp/install?${encodeURIComponent('{"name":"brew","type":"http","url":"https://brew.new/api/mcp"}')}`
    )
  })

  it('is unchanged on a second run', async () => {
    const { root, env } = setup(['.cursor'])
    await install([], { root, env })
    const before = readFileSync(join(root, '.cursor/mcp.json'), 'utf8')
    const { output } = await install([], { root, env })
    expect(output.clients[0]?.action).toBe('unchanged')
    expect(readFileSync(join(root, '.cursor/mcp.json'), 'utf8')).toBe(before)
  })

  it('merges into an existing config, keeping other servers, settings and indent', async () => {
    const { root, env } = setup()
    mkdirSync(join(root, '.gemini'))
    writeFileSync(
      join(root, '.gemini/settings.json'),
      `${JSON.stringify(
        {
          theme: 'GitHub',
          mcpServers: {
            github: { httpUrl: 'https://api.githubcopilot.com/mcp/' },
          },
        },
        null,
        4
      )}\n`
    )
    const { output } = await install(['--client', 'gemini'], { root, env })
    expect(output.clients[0]?.action).toBe('updated')
    const text = readFileSync(join(root, '.gemini/settings.json'), 'utf8')
    expect(text).toContain('\n    "theme"')
    expect(JSON.parse(text)).toEqual({
      theme: 'GitHub',
      mcpServers: {
        github: { httpUrl: 'https://api.githubcopilot.com/mcp/' },
        brew: { httpUrl: 'https://brew.new/api/mcp' },
      },
    })
  })

  it('never replaces a customised brew entry: unchanged when equal, else manual', async () => {
    const { root, env } = setup()
    const custom = `${JSON.stringify(
      {
        mcpServers: {
          brew: {
            type: 'http',
            url: 'https://brew.new/api/mcp',
            headers: { Authorization: PLAIN_ENV_HEADER },
          },
          other: { command: 'x' },
        },
      },
      null,
      2
    )}\n`
    writeFileSync(join(root, '.mcp.json'), custom)
    // Default --auth oauth would drop the header: the entry is the user's.
    const oauth = await install(['--client', 'claude-code'], { root, env })
    expect(oauth.output.clients[0]).toMatchObject({
      action: 'manual',
      note: expect.stringMatching(/other settings/),
    })
    expect(JSON.parse(oauth.output.clients[0]?.snippet ?? '')).toEqual({
      mcpServers: { brew: { type: 'http', url: 'https://brew.new/api/mcp' } },
    })
    expect(readFileSync(join(root, '.mcp.json'), 'utf8')).toBe(custom)
    // The same settings again: nothing to do.
    const same = await install(['--client', 'claude-code', '--auth', 'env'], {
      root,
      env,
    })
    expect(same.output.clients[0]?.action).toBe('unchanged')
    // A stale URL is still the user's entry, never silently rewritten.
    writeFileSync(
      join(root, '.mcp.json'),
      JSON.stringify({
        mcpServers: { brew: { type: 'http', url: 'https://old.example/mcp' } },
      })
    )
    const stale = await install(['--client', 'claude-code'], { root, env })
    expect(stale.output.clients[0]?.action).toBe('manual')
    expect(readFileSync(join(root, '.mcp.json'), 'utf8')).toContain(
      'https://old.example/mcp'
    )
  })

  it('reads a config that starts with a byte order mark, and keeps the mark', async () => {
    const { root, env } = setup()
    mkdirSync(join(root, '.cursor'))
    writeFileSync(
      join(root, '.cursor/mcp.json'),
      `\uFEFF${JSON.stringify({ mcpServers: { other: { url: 'https://x.example/mcp' } } }, null, 2)}\n`
    )
    const first = await install(['--client', 'cursor'], { root, env })
    expect(first.output.clients[0]?.action).toBe('updated')
    const text = readFileSync(join(root, '.cursor/mcp.json'), 'utf8')
    expect(text.startsWith('\uFEFF')).toBe(true)
    expect(JSON.parse(text.slice(1))).toEqual({
      mcpServers: {
        other: { url: 'https://x.example/mcp' },
        brew: { url: 'https://brew.new/api/mcp' },
      },
    })
    const second = await install(['--client', 'cursor'], { root, env })
    expect(second.output.clients[0]?.action).toBe('unchanged')
  })

  it('never writes through a link that leaves the project; a home link into dotfiles still works', async () => {
    const { root, home, env } = setup(['.cursor'])
    const outside = tempProject('brew-cli-outside-')
    writeFileSync(join(outside, 'mcp.json'), '{}\n')
    symlinkSync(join(outside, 'mcp.json'), join(root, '.cursor/mcp.json'))
    const project = await install(['--client', 'cursor'], { root, env })
    expect(project.output.clients[0]).toMatchObject({
      action: 'manual',
      note: expect.stringMatching(/^Not written: .*outside/),
    })
    expect(readFileSync(join(outside, 'mcp.json'), 'utf8')).toBe('{}\n')

    mkdirSync(join(home, 'dotfiles'))
    mkdirSync(join(home, '.cursor'))
    writeFileSync(join(home, 'dotfiles/mcp.json'), '{}\n')
    symlinkSync(join(home, 'dotfiles/mcp.json'), join(home, '.cursor/mcp.json'))
    const user = await install(['--client', 'cursor', '--scope', 'user'], {
      root,
      env,
    })
    expect(user.output.clients[0]?.action).toBe('updated')
    expect(lstatSync(join(home, '.cursor/mcp.json')).isSymbolicLink()).toBe(
      true
    )
    expect(readJson(join(home, 'dotfiles/mcp.json'))).toEqual({
      mcpServers: { brew: { url: 'https://brew.new/api/mcp' } },
    })
  })

  it('hands back a snippet instead of rewriting a config with comments', async () => {
    const { root, env } = setup()
    mkdirSync(join(root, '.vscode'))
    const jsonc = '{\n  // my servers\n  "servers": {},\n}\n'
    writeFileSync(join(root, '.vscode/mcp.json'), jsonc)
    const { output } = await install(['--client', 'vscode'], { root, env })
    expect(output.clients[0]).toMatchObject({
      client: 'vscode',
      path: '.vscode/mcp.json',
      action: 'manual',
      note: expect.stringMatching(/comments/),
    })
    expect(JSON.parse(output.clients[0]?.snippet ?? '')).toEqual({
      servers: { brew: { type: 'http', url: 'https://brew.new/api/mcp' } },
    })
    expect(readFileSync(join(root, '.vscode/mcp.json'), 'utf8')).toBe(jsonc)
  })

  it('reports a broken JSON file as manual', async () => {
    const { root, env } = setup()
    writeFileSync(join(root, '.mcp.json'), '{"mcpServers": ')
    const { output } = await install(['--client', 'claude-code'], {
      root,
      env,
    })
    expect(output.clients[0]).toMatchObject({
      action: 'manual',
      note: expect.stringMatching(/Not valid JSON/),
    })
  })

  it('plans without writing on --dry-run', async () => {
    const { root, env } = setup(['.cursor'])
    const { code, output } = await install(['--dry-run'], { root, env })
    expect(code).toBe(0)
    expect(output.dryRun).toBe(true)
    expect(output.clients[0]?.action).toBe('created')
    expect(existsSync(join(root, '.cursor/mcp.json'))).toBe(false)
  })

  it('prints snippets for every client on --print, writing nothing', async () => {
    const { root, home, env } = setup()
    const { output } = await install(['--print'], { root, env })
    expect(output.clients.map((result) => result.client)).toEqual([
      'cursor',
      'vscode',
      'claude-code',
      'gemini',
      'windsurf',
      'codex',
    ])
    expect(output.clients.every((result) => result.action === 'printed')).toBe(
      true
    )
    expect(output.clients[5]?.snippet).toBe(
      '[mcp_servers.brew]\nurl = "https://brew.new/api/mcp"\n'
    )
    expect(existsSync(join(root, '.cursor'))).toBe(false)
    expect(existsSync(join(home, '.codex'))).toBe(false)
  })

  it('writes Devin Desktop (Windsurf) and Codex user configs only when named', async () => {
    const { root, home, env } = setup(['.windsurf', '.codex'])
    const detected = await install([], { root, env })
    expect(detected.output.clients.map((result) => result.action)).toEqual([
      'manual',
      'manual',
    ])
    expect(existsSync(join(home, '.config'))).toBe(false)

    const named = await install(
      ['--client', 'windsurf,codex', '--auth', 'env'],
      {
        root,
        env,
      }
    )
    expect(named.output.clients).toMatchObject([
      {
        client: 'windsurf',
        path: join(home, '.config/devin/mcp_config.json'),
        action: 'created',
      },
      {
        client: 'codex',
        path: join(home, '.codex/config.toml'),
        action: 'created',
      },
    ])
    expect(existsSync(join(home, '.codeium'))).toBe(false)
    // `url`: read by both of Devin Desktop's agents (Cascade and Devin Local).
    expect(readJson(join(home, '.config/devin/mcp_config.json'))).toEqual({
      mcpServers: {
        brew: {
          url: 'https://brew.new/api/mcp',
          headers: { Authorization: ENV_HEADER },
        },
      },
    })
    expect(readFileSync(join(home, '.codex/config.toml'), 'utf8')).toBe(
      '[mcp_servers.brew]\nurl = "https://brew.new/api/mcp"\nbearer_token_env_var = "BREW_API_KEY"\n'
    )
    // The env-header entry needs no sign-in step.
    expect(named.output.clients[1]?.nextStep).toBeUndefined()
  })

  it('writes Devin Desktop under $XDG_CONFIG_HOME, and detects a .devin/ project', async () => {
    const { root, home, env } = setup(['.devin'])
    const xdg = join(home, 'xdg')
    const detected = await install([], { root, env })
    expect(detected.output.clients).toMatchObject([
      { client: 'windsurf', action: 'manual' },
    ])
    const { output } = await install(['--client', 'windsurf'], {
      root,
      env: { ...env, XDG_CONFIG_HOME: xdg },
    })
    expect(output.clients[0]).toMatchObject({
      path: join(xdg, 'devin/mcp_config.json'),
      action: 'created',
    })
  })

  it('tells Codex to sign in after an OAuth entry', async () => {
    const { root, env } = setup()
    const { output } = await install(['--client', 'codex'], { root, env })
    expect(output.clients[0]).toMatchObject({
      action: 'created',
      nextStep: 'codex mcp login brew',
    })
    const human = await runCli(['mcp', 'install', '--client', 'codex'], {
      cwd: root,
      env,
      ttyOut: true,
    })
    expect(human.stdout).toContain('Then sign in: codex mcp login brew')
  })

  it('appends to an existing Codex config once, then reports unchanged', async () => {
    const { root, home, env } = setup()
    mkdirSync(join(home, '.codex'))
    writeFileSync(
      join(home, '.codex/config.toml'),
      'model = "gpt-5"\n\n[mcp_servers.docs]\nurl = "https://docs.example/mcp"\n'
    )
    const first = await install(['--client', 'codex'], { root, env })
    expect(first.output.clients[0]?.action).toBe('updated')
    expect(readFileSync(join(home, '.codex/config.toml'), 'utf8')).toBe(
      'model = "gpt-5"\n\n[mcp_servers.docs]\nurl = "https://docs.example/mcp"\n\n[mcp_servers.brew]\nurl = "https://brew.new/api/mcp"\n'
    )
    const second = await install(['--client', 'codex'], { root, env })
    expect(second.output.clients[0]?.action).toBe('unchanged')
    const envAuth = await install(['--client', 'codex', '--auth', 'env'], {
      root,
      env,
    })
    expect(envAuth.output.clients[0]).toMatchObject({
      action: 'manual',
      snippet: expect.stringContaining('bearer_token_env_var'),
    })
  })

  it('never appends a second brew table to a Codex config that has one', async () => {
    const { root, home, env } = setup()
    mkdirSync(join(home, '.codex'))
    const configs = {
      quotedHeader: '["mcp_servers".brew]\nurl = "https://brew.new/api/mcp"\n',
      quotedBoth:
        '[\'mcp_servers\'."brew"]\nurl = "https://brew.new/api/mcp"\n',
      dottedKey: 'mcp_servers.brew.url = "https://brew.new/api/mcp"\n',
      subTable: '[mcp_servers.brew.env]\nX = "1"\n',
      serversTable:
        '[mcp_servers]\nbrew = { url = "https://brew.new/api/mcp" }\n',
      inline: 'mcp_servers = { brew = { url = "https://x" } }\n',
      // Appending [mcp_servers.brew] to these breaks the file (each checked
      // against `codex mcp list`): an inline table cannot be extended, a
      // dotted `brew.url` already defines the table, `[[…]]` is not a map.
      inlineOthers:
        'mcp_servers = { docs = { url = "https://docs.example" } }\n',
      inlineEmpty: 'model = "x"\nmcp_servers = {}\n',
      dottedUnderTable:
        '[mcp_servers]\nbrew.url = "https://brew.new/api/mcp"\n',
      quotedDottedUnderTable: '[mcp_servers]\n"brew" . url = "https://x"\n',
      arrayOfTables: '[[mcp_servers]]\nname = "docs"\n',
      bracketInValue: 'tags = ["[a"]\nmcp_servers = {}\n',
      subTableBesideTable:
        '[mcp_servers.brew]\nurl = "https://brew.new/api/mcp"\n\n[mcp_servers.brew.http_headers]\nX = "1"\n',
    }
    for (const [name, text] of Object.entries(configs)) {
      writeFileSync(join(home, '.codex/config.toml'), text)
      const { output } = await install(['--client', 'codex'], { root, env })
      expect(
        ['unchanged', 'manual'].includes(output.clients[0]?.action ?? ''),
        name
      ).toBe(true)
      expect(readFileSync(join(home, '.codex/config.toml'), 'utf8'), name).toBe(
        text
      )
    }
    // Comments and string values that only mention it are not definitions.
    for (const text of [
      '# mcp_servers.brew.url was removed\n',
      '# [mcp_servers.brew]\nmodel = "x"\n',
      'notes = "mcp_servers.brew = old"\n',
      'args = [\n  "mcp_servers.brew.url",\n]\n',
      "doc = '''\n[mcp_servers.brew]\n'''\n",
    ]) {
      writeFileSync(join(home, '.codex/config.toml'), text)
      const { output } = await install(['--client', 'codex'], { root, env })
      expect(output.clients[0]?.action, text).toBe('updated')
      expect(
        readFileSync(join(home, '.codex/config.toml'), 'utf8'),
        text
      ).toContain('\n[mcp_servers.brew]\nurl = "https://brew.new/api/mcp"\n')
    }
    // A table defined by dotted keys can take a new sub-table (codex
    // accepts the result), and an inline table under another table is not
    // the root mcp_servers.
    for (const text of [
      'mcp_servers.docs.url = "https://docs.example/mcp"\n',
      '[profiles.work]\nmcp_servers = { docs = { url = "https://d" } }\n',
    ]) {
      writeFileSync(join(home, '.codex/config.toml'), text)
      const { output } = await install(['--client', 'codex'], { root, env })
      expect(output.clients[0]?.action, text).toBe('updated')
    }
    // A different server whose name starts with brew is not ours.
    writeFileSync(
      join(home, '.codex/config.toml'),
      '[mcp_servers.brew-staging]\nurl = "https://staging.example/api/mcp"\n'
    )
    const { output } = await install(['--client', 'codex'], { root, env })
    expect(output.clients[0]?.action).toBe('updated')
  })

  it('honours CODEX_HOME', async () => {
    const { root, home, env } = setup()
    const codexHome = join(home, 'custom-codex')
    const { output } = await install(['--client', 'codex'], {
      root,
      env: { ...env, CODEX_HOME: codexHome },
    })
    expect(output.clients[0]?.path).toBe(join(codexHome, 'config.toml'))
  })

  it('never writes a literal key with --auth env', async () => {
    const { root, env } = setup()
    const key = 'brew_live_0123456789abcdefghij'
    const { output } = await install(
      ['--client', 'all', '--auth', 'env', '--api-key', key],
      { root, env: { ...env, BREW_API_KEY: key } }
    )
    expect(JSON.stringify(output)).not.toContain(key)
    const cursor = readFileSync(join(root, '.cursor/mcp.json'), 'utf8')
    expect(cursor).toContain(ENV_HEADER)
    expect(cursor).not.toContain(key)
    expect(readFileSync(join(root, '.mcp.json'), 'utf8')).toContain(
      PLAIN_ENV_HEADER
    )
  })

  it('detects Claude Code from CLAUDECODE=1', async () => {
    const { root, env } = setup()
    const { output } = await install([], {
      root,
      env: { ...env, CLAUDECODE: '1' },
    })
    expect(output.clients.map((result) => result.client)).toEqual([
      'claude-code',
    ])
  })

  it('writes user scope to the home directory; Claude Code gets its own command', async () => {
    const { root, home, env } = setup()
    const { output } = await install(
      ['--client', 'cursor', 'claude-code', '--scope', 'user'],
      { root, env }
    )
    expect(output.clients[0]).toMatchObject({
      path: join(home, '.cursor/mcp.json'),
      action: 'created',
    })
    expect(output.clients[1]).toMatchObject({
      client: 'claude-code',
      action: 'manual',
      snippet:
        'claude mcp add --transport http --scope user brew https://brew.new/api/mcp',
    })
  })

  it('puts the variadic --header after the name and URL in the Claude Code command', async () => {
    const { root, env } = setup()
    const { output } = await install(
      ['--client', 'claude-code', '--scope', 'user', '--auth', 'env'],
      { root, env }
    )
    // `-H, --header <header...>` swallows every word after it, so before
    // the name it fails with "missing required argument 'name'".
    expect(output.clients[0]?.snippet).toBe(
      `claude mcp add --transport http --scope user brew https://brew.new/api/mcp --header 'Authorization: ${PLAIN_ENV_HEADER}'`
    )
    expect(claudeMcpAddCommand('https://x.example/mcp', 'env')).toMatch(
      / brew https:\/\/x\.example\/mcp --header '[^']+'$/
    )
  })

  it('derives the MCP URL from --api-url', async () => {
    const { root, env } = setup(['.cursor'])
    const { output } = await install(
      ['--api-url', 'http://localhost:3000/api'],
      { root, env }
    )
    expect(output.mcpUrl).toBe('http://localhost:3000/api/mcp')
    expect(readJson(join(root, '.cursor/mcp.json'))).toEqual({
      mcpServers: { brew: { url: 'http://localhost:3000/api/mcp' } },
    })
  })

  it('writes at the monorepo root when run inside a workspace', async () => {
    const root = copyFixture('pnpm-turbo')
    mkdirSync(join(root, '.cursor'))
    const home = tempProject('brew-cli-home-')
    const result = await runCli(['mcp', 'install', '--json'], {
      cwd: join(root, 'apps/web'),
      env: { HOME: home, BREW_CLI_CONFIG_DIR: join(home, '.config/brew-cli') },
    })
    expect((result.json as Output).clients[0]?.path).toBe('.cursor/mcp.json')
    expect(existsSync(join(root, '.cursor/mcp.json'))).toBe(true)
  })

  it('acts on the git repository root when no package.json is found', async () => {
    const { root, env } = setup(['.cursor'])
    mkdirSync(join(root, 'docs/guides'), { recursive: true })
    const calls: Array<{ command: string; args: readonly string[] }> = []
    const spawn: SpawnFn = async (command, args) => {
      calls.push({ command, args })
      return { code: 0, stdout: `${root}\n`, stderr: '' }
    }
    const { code, output } = await install([], {
      root: join(root, 'docs/guides'),
      env,
      spawn,
    })
    expect(code).toBe(0)
    expect(calls).toEqual([
      { command: 'git', args: ['rev-parse', '--show-toplevel'] },
    ])
    expect(output.clients[0]).toMatchObject({
      client: 'cursor',
      path: '.cursor/mcp.json',
      action: 'created',
    })
    expect(existsSync(join(root, '.cursor/mcp.json'))).toBe(true)
    expect(existsSync(join(root, 'docs/guides/.cursor'))).toBe(false)
  })

  it('fails as a usage error when nothing is detected or a client is unknown', async () => {
    const { root, env } = setup()
    const none = await runCli(['mcp', 'install', '--json'], { cwd: root, env })
    expect(none.code).toBe(2)
    expect(JSON.parse(none.stderr).error.message).toMatch(
      /No MCP client detected/
    )
    const unknown = await runCli(
      ['mcp', 'install', '--client', 'emacs', '--json'],
      { cwd: root, env }
    )
    expect(unknown.code).toBe(2)
    const scope = await runCli(
      ['mcp', 'install', '--client', 'cursor', '--scope', 'global', '--json'],
      { cwd: root, env }
    )
    expect(scope.code).toBe(2)
  })

  it('renders a readable summary in human mode', async () => {
    const { root, env } = setup(['.cursor'])
    const result = await runCli(['mcp', 'install'], {
      cwd: root,
      env,
      ttyOut: true,
    })
    expect(result.stdout).toContain('created  Cursor (.cursor/mcp.json)')
    expect(result.stdout).toContain(`One-click install: ${BREW_V2_CURSOR_LINK}`)
  })
})

describe('MCP client builders', () => {
  it('matches brew-v2 buildCursorInstallUrl byte for byte', () => {
    expect(buildCursorInstallUrl()).toBe(BREW_V2_CURSOR_LINK)
    // Unpadded base64url: no '+', '/' or '='.
    expect(
      buildCursorInstallUrl('https://example.test/api/mcp?x=1', 'env')
    ).toMatch(/config=[A-Za-z0-9_-]+$/)
  })

  it('builds the VS Code link from encodeURIComponent(JSON)', () => {
    expect(buildVsCodeInstallUrl('https://brew.new/api/mcp')).toBe(
      'vscode:mcp/install?%7B%22name%22%3A%22brew%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fbrew.new%2Fapi%2Fmcp%22%7D'
    )
  })

  it('derives the MCP URL from any API base URL', () => {
    expect(mcpUrlFromApiUrl('https://brew.new/api')).toBe(
      'https://brew.new/api/mcp'
    )
    expect(mcpUrlFromApiUrl('https://tunnel.example/x/api/')).toBe(
      'https://tunnel.example/api/mcp'
    )
  })

  it('finds the VS Code user directory per platform', () => {
    expect(vscodeUserDir('/h', {}, 'darwin')).toBe(
      '/h/Library/Application Support/Code/User'
    )
    expect(vscodeUserDir('/h', {}, 'linux')).toBe('/h/.config/Code/User')
    expect(vscodeUserDir('/h', { XDG_CONFIG_HOME: '/x' }, 'linux')).toBe(
      '/x/Code/User'
    )
    const target = configTarget('vscode', 'user', {
      projectRoot: '/p',
      home: '/h',
      env: {},
      url: 'https://brew.new/api/mcp',
      auth: 'oauth',
      platform: 'linux',
    })
    expect(target).toEqual({
      kind: 'file',
      path: '/h/.config/Code/User/mcp.json',
      scope: 'user',
      within: '/h',
    })
  })

  it('finds the Devin Desktop (Windsurf) config directory per platform', () => {
    // docs.devin.ai/desktop/cascade/mcp: ~/.config/devin on macOS and
    // Linux ($XDG_CONFIG_HOME first), %APPDATA%\devin on Windows.
    expect(devinConfigDir('/h', {}, 'darwin')).toBe('/h/.config/devin')
    expect(devinConfigDir('/h', {}, 'linux')).toBe('/h/.config/devin')
    expect(devinConfigDir('/h', { XDG_CONFIG_HOME: '/x' }, 'darwin')).toBe(
      '/x/devin'
    )
    expect(devinConfigDir('/h', { APPDATA: '/appdata' }, 'win32')).toBe(
      '/appdata/devin'
    )
    expect(
      configTarget('windsurf', 'project', {
        projectRoot: '/p',
        home: '/h',
        env: {},
        url: 'https://brew.new/api/mcp',
        auth: 'oauth',
        platform: 'linux',
      })
    ).toEqual({
      kind: 'file',
      path: '/h/.config/devin/mcp_config.json',
      scope: 'user',
      within: '/h',
    })
  })
})
