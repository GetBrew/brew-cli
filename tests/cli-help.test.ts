import { describe, expect, it } from 'vitest'
import { runCli } from './helpers/run-cli'

describe('cli basics', () => {
  it('prints help with the agent footer and exits 0', async () => {
    const result = await runCli(['--help'])
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Agent-first CLI for the Brew public API')
    expect(result.stdout).toContain('docs --agent')
    expect(result.stdout).toContain('Exit codes:')
  })

  it('prints the dev version', async () => {
    const result = await runCli(['--version'])
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toBe('0.0.0-dev')
  })

  it('fails unknown commands hard, with a structured envelope in JSON mode', async () => {
    const result = await runCli(['nonsense'])
    expect(result.code).toBe(2)
    const parsed = JSON.parse(result.stderr) as { error: { code: string } }
    expect(parsed.error.code).toBe('CLI_USAGE')
    expect(result.stderr).toContain("unknown command 'nonsense'")
    expect(result.stderr).not.toContain('Did you mean')
  })

  it('treats bare groups and bare invocations as usage errors', async () => {
    const bareGroup = await runCli(['contacts'])
    expect(bareGroup.code).toBe(2)
    const parsed = JSON.parse(bareGroup.stderr) as { error: { code: string } }
    expect(parsed.error.code).toBe('CLI_USAGE')

    const bare = await runCli([])
    expect(bare.code).toBe(2)

    const humanGroup = await runCli(['contacts'], { ttyOut: true })
    expect(humanGroup.code).toBe(2)
    expect(humanGroup.stderr).toContain('Usage:')
  })

  it('accepts global flags in group position', async () => {
    const result = await runCli(['config', '--json', 'list'], {
      env: { BREW_CLI_CONFIG_DIR: '/nonexistent-config-dir' },
    })
    expect(result.code).toBe(0)
    expect(result.json).toBeDefined()
  })

  it('never echoes an --api-key value in the confirmation envelope', async () => {
    const secret = 'brew_supersecret0000000000000000'
    const result = await runCli(
      ['--api-key', secret, 'contacts', 'delete', 'jane@example.com'],
      { env: { BREW_CLI_CONFIG_DIR: '/nonexistent-config-dir' } }
    )
    expect(result.code).toBe(4)
    expect(result.stdout).not.toContain(secret)
    const envelope = result.json as { confirmCommand: string }
    expect(envelope.confirmCommand).toBe(
      'brew-cli contacts delete jane@example.com --yes'
    )
  })

  it('accepts global flags before the subcommand', async () => {
    const result = await runCli(['--json', 'docs'])
    expect(result.code).toBe(0)
    expect(result.json).toBeDefined()
    const before = await runCli(
      ['--quiet', '--yes', 'contacts', 'delete', 'x@y.z'],
      {
        env: { BREW_CLI_CONFIG_DIR: '/nonexistent-config-dir' },
      }
    )
    // --yes before the subcommand must reach the confirmation gate (the
    // command then fails on auth, not on confirmation).
    expect(before.code).toBe(3)
  })

  it('command help shows the API route, examples, and global flags', async () => {
    const result = await runCli(['usage', '--help'])
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('API route: GET /v1/usage')
    expect(result.stdout).toContain('Examples:')
    expect(result.stdout).toContain('brew-cli usage --json')
    expect(result.stdout).toContain('--json')
  })
})
