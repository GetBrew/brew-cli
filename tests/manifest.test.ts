import { describe, expect, it } from 'vitest'
import { defineCommand } from '../src/lib/define-command'
import { buildManifest } from '../src/lib/manifest'
import { runCli } from './helpers/run-cli'

describe('docs --agent manifest', () => {
  it('builds the manifest from supplied metadata rather than importing the handler registry', () => {
    const command = defineCommand({
      path: ['fixture'],
      summary: 'Fixture',
      sdkMethod: null,
      commandClass: 'read',
      examples: ['brew-cli fixture'],
      run: async () => ({ data: null }),
    })
    const manifest = buildManifest({
      commands: [{ ...command, confirmation: false }],
    })
    expect(manifest.commands).toEqual([
      expect.objectContaining({ command: 'brew-cli fixture' }),
    ])
  })
  it('prints a complete machine-readable manifest', async () => {
    const result = await runCli(['docs', '--agent'])
    expect(result.code).toBe(0)
    const manifest = result.json as {
      name: string
      version: string
      exitCodes: Record<string, string>
      confirmationProtocol: { exitCode: number; override: string }
      globalFlags: Array<{ flag: string }>
      commands: Array<Record<string, unknown>>
      skips: { sdk: unknown[]; spec: unknown[] }
    }
    expect(manifest.name).toBe('brew-cli')
    expect(manifest.exitCodes['4']).toContain('confirmation')
    expect(manifest.confirmationProtocol.exitCode).toBe(4)
    expect(manifest.confirmationProtocol.override).toBe('--yes')
    expect(manifest.globalFlags.length).toBeGreaterThan(0)
    expect(manifest.commands.length).toBeGreaterThan(10)
    for (const command of manifest.commands) {
      expect(typeof command.command).toBe('string')
      expect(typeof command.summary).toBe('string')
      expect(['read', 'write', 'destructive']).toContain(command.class)
      expect(Array.isArray(command.examples)).toBe(true)
      expect((command.examples as unknown[]).length).toBeGreaterThan(0)
    }
    expect(Array.isArray(manifest.skips.sdk)).toBe(true)
    expect(Array.isArray(manifest.skips.spec)).toBe(true)
  })

  it('marks every destructive command as requiring confirmation', async () => {
    const result = await runCli(['docs', '--agent'])
    const manifest = result.json as {
      commands: Array<{ class: string; confirmation: boolean }>
    }
    for (const command of manifest.commands) {
      expect(command.confirmation).toBe(command.class === 'destructive')
    }
  })

  it('marks commands with optional paid modes as credited', async () => {
    const result = await runCli(['docs', '--agent'])
    expect(result.code).toBe(0)
    const manifest = result.json as {
      commands: Array<{ command: string; credited?: boolean }>
    }
    const credited = new Set(
      manifest.commands
        .filter((command) => command.credited === true)
        .map((command) => command.command)
    )
    for (const command of [
      'contacts upsert',
      'contacts upsert-many',
      'contacts import',
      'contacts import-csv',
    ]) {
      expect(credited.has(`brew-cli ${command}`), command).toBe(true)
    }
  })
})
