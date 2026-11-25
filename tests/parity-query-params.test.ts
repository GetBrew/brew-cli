import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { ALL_COMMANDS } from '../src/registry'

function specQueryParameters(): Map<string, ReadonlyArray<string>> {
  const doc = parse(
    readFileSync(
      join(import.meta.dirname, '../openapi/public-api-v1.yaml'),
      'utf8'
    )
  ) as {
    paths?: Record<
      string,
      Record<string, { parameters?: Array<{ name?: string; in?: string }> }>
    >
  }
  const byRoute = new Map<string, ReadonlyArray<string>>()
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const [method, operation] of Object.entries(item)) {
      const names = (operation.parameters ?? []).flatMap((parameter) =>
        parameter.in === 'query' && parameter.name ? [parameter.name] : []
      )
      byRoute.set(`${method.toUpperCase()} ${path}`, names)
    }
  }
  return byRoute
}

const kebab = (name: string): string =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

const RENAMED: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'analytics overview': { from: '--since', to: '--until' },
}

const EXEMPT: Readonly<Record<string, string>> = {}

type Command = (typeof ALL_COMMANDS)[number]

const nameOf = (command: Command): string => command.path.join(' ')

const flagNames = (command: Command): Set<string> =>
  new Set((command.flags ?? []).map((flag) => flag.flag.split(' ')[0] ?? ''))

function unreachable(
  command: Command,
  parameters: Map<string, ReadonlyArray<string>>
): Array<string> {
  const names = command.route
    ? parameters.get(`${command.route.method} ${command.route.path}`)
    : undefined
  const flags = flagNames(command)
  if (!names || flags.has('--input')) {
    return []
  }
  return names.flatMap((name) => {
    const flag = RENAMED[nameOf(command)]?.[name] ?? `--${kebab(name)}`
    return flags.has(flag) ? [] : [`${nameOf(command)}: ?${name} (${flag})`]
  })
}

describe('query parameter flags', () => {
  const parameters = specQueryParameters()

  it('reach every query parameter of a command without --input', () => {
    const checked = ALL_COMMANDS.filter(
      (command) =>
        command.route &&
        (parameters.get(`${command.route.method} ${command.route.path}`)
          ?.length ?? 0) > 0 &&
        !flagNames(command).has('--input')
    )
    expect(checked.length).toBeGreaterThan(5)
    const missing = ALL_COMMANDS.filter(
      (command) => !(nameOf(command) in EXEMPT)
    ).flatMap((command) => unreachable(command, parameters))
    expect(missing).toEqual([])
  })

  it('keep their RENAMED and EXEMPT entries current', () => {
    const byName = new Map(
      ALL_COMMANDS.map((command) => [nameOf(command), command])
    )
    const stale: Array<string> = []
    for (const [name, renames] of Object.entries(RENAMED)) {
      const command = byName.get(name)
      const names = command?.route
        ? parameters.get(`${command.route.method} ${command.route.path}`)
        : undefined
      for (const [parameter, flag] of Object.entries(renames)) {
        if (!(command && names?.includes(parameter))) {
          stale.push(`RENAMED ${name}: ?${parameter} is not in the spec`)
        } else if (!flagNames(command).has(flag)) {
          stale.push(`RENAMED ${name}: ${flag} is not a flag`)
        }
      }
    }
    for (const name of Object.keys(EXEMPT)) {
      const command = byName.get(name)
      if (!command || unreachable(command, parameters).length === 0) {
        stale.push(`EXEMPT ${name}: nothing left to exempt`)
      }
    }
    expect(stale).toEqual([])
  })
})
