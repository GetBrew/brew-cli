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

  it('fails unknown commands hard, with no fuzzy suggestion', async () => {
    const result = await runCli(['nonsense'])
    expect(result.code).toBe(2)
    expect(result.stderr).toContain("unknown command 'nonsense'")
    expect(result.stderr).not.toContain('Did you mean')
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
