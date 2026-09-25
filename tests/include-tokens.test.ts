import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { ALL_COMMANDS } from '../src/registry'

/**
 * Every `--include` flag's help names exactly the tokens the spec publishes
 * for its route (`x-brew-include-tokens`, generated from the tuples the API
 * parses with). SDK 11.0.0's typed include unions drifted from the API
 * (`automations` where the API takes `skill`); help text can drift the same
 * way, and a re-vendored spec now makes that a test failure.
 */
function publishedIncludeTokens(): Map<string, ReadonlyArray<string>> {
  const doc = parse(
    readFileSync(
      join(import.meta.dirname, '../openapi/public-api-v1.yaml'),
      'utf8'
    )
  ) as {
    paths?: Record<
      string,
      Record<
        string,
        {
          parameters?: Array<{
            name?: string
            in?: string
            schema?: { 'x-brew-include-tokens'?: ReadonlyArray<string> }
          }>
        }
      >
    >
  }
  const tokens = new Map<string, ReadonlyArray<string>>()
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const [method, operation] of Object.entries(item)) {
      const include = operation.parameters?.find(
        (parameter) => parameter.in === 'query' && parameter.name === 'include'
      )
      const published = include?.schema?.['x-brew-include-tokens']
      if (published) {
        tokens.set(`${method.toUpperCase()} ${path}`, published)
      }
    }
  }
  return tokens
}

/**
 * The tokens a help line names after its colon, e.g. "Comma-separated
 * expansions: count, build", "Expansions: skill (a SKILL.md-shaped wiring
 * brief)" or "Comma-separated embeds: identity | emailDesign".
 */
function namedTokens(summary: string): Array<string> {
  return summary
    .slice(summary.indexOf(':') + 1)
    .replace(/\([^)]*\)/g, '')
    .split(/[,|]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

const byName = (a: string, b: string) => a.localeCompare(b)

describe('--include flags', () => {
  it('name exactly the tokens the spec publishes for their route', () => {
    const published = publishedIncludeTokens()
    const checked: Array<string> = []
    const drift: Array<string> = []
    for (const command of ALL_COMMANDS) {
      const flag = command.flags?.find((candidate) =>
        candidate.flag.startsWith('--include ')
      )
      const tokens = command.route
        ? published.get(`${command.route.method} ${command.route.path}`)
        : undefined
      // A list command's `--include` is a compat flag that points at the
      // detail read; its route takes no include.
      if (!(flag && tokens)) {
        continue
      }
      const name = command.path.join(' ')
      checked.push(name)
      const named = namedTokens(flag.summary)
      if (
        JSON.stringify([...named].sort(byName)) !==
        JSON.stringify([...tokens].sort(byName))
      ) {
        drift.push(
          `${name}: help names ${named.join(', ')}; the spec publishes ${tokens.join(', ')}`
        )
      }
    }
    expect(published.size).toBeGreaterThanOrEqual(10)
    expect(checked.length).toBeGreaterThanOrEqual(9)
    expect(drift).toEqual([])
  })
})
