import { Option } from 'commander'
import type { CommandInvocation, CommandSpec } from './define-command'
import { GLOBAL_FLAGS } from './define-command'
import { DEFAULT_INVOCATION_PREFIX } from './invocation'

export type RerunInvocation = Pick<CommandInvocation, 'args' | 'flags'>
type RerunCommand = Pick<CommandSpec, 'path' | 'flags' | 'args'>

/** Serialize the parser's effective invocation instead of parsing argv again. */
export function buildRerunCommand(
  command: RerunCommand,
  invocation: RerunInvocation,
  overrides: {
    readonly yes?: boolean
    readonly idempotencyKey?: string
    readonly inlineInput?: string
    /** How the CLI was invoked (`getInvocationPrefix`); plain shell words. */
    readonly prefix?: string
  }
): string {
  const flags: Readonly<Record<string, unknown>> = {
    ...invocation.flags,
    ...(overrides.yes === undefined ? {} : { yes: overrides.yes }),
    ...(overrides.idempotencyKey === undefined
      ? {}
      : { idempotencyKey: overrides.idempotencyKey }),
    ...(overrides.inlineInput === undefined
      ? {}
      : { input: overrides.inlineInput }),
  }
  const tokens = [...command.path]
  const emitted = new Set<string>()
  for (const flag of [...(command.flags ?? []), ...GLOBAL_FLAGS]) {
    const option = new Option(flag.flag)
    const name = option.attributeName()
    if (name === 'apiKey' || emitted.has(name)) {
      continue
    }
    const value = flags[name]
    const spelling = option.long ?? option.short
    if (!(option.required || option.optional)) {
      // A `--x` / `--no-x` pair shares one name: the matching spelling wins.
      if (spelling !== undefined && value === !option.negate) {
        emitted.add(name)
        tokens.push(spelling)
      }
      continue
    }
    emitted.add(name)
    if (spelling === undefined || value === undefined) {
      continue
    }
    if (option.optional && value === true) {
      tokens.push(spelling)
      continue
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      if (
        !['string', 'number', 'boolean'].includes(typeof item) ||
        (name === 'header' && isCredentialHeader(String(item)))
      ) {
        continue
      }
      // Attached values cannot become ancestor options or extend a variadic
      // option into the next flag or positional argument.
      tokens.push(`${spelling}=${String(item)}`)
    }
  }
  const operands = (command.args ?? []).flatMap((arg) => {
    const value = invocation.args[arg.name]
    return value === undefined ? [] : [value]
  })
  if (operands.length > 0) {
    tokens.push('--', ...operands)
  }
  return [
    overrides.prefix ?? DEFAULT_INVOCATION_PREFIX,
    ...tokens.map(shellQuote),
  ].join(' ')
}

/** Only effective parsed input flags can require stdin on a retry. */
export function readsStdin(invocation: RerunInvocation): boolean {
  return ['input', 'file', 'jsxFile', 'data'].some(
    (name) => invocation.flags[name] === '-'
  )
}

/** Credential headers must not reach confirmation/retry envelopes or transcripts. */
const CREDENTIAL_HEADER_NAME =
  /authorization|cookie|api-?key|auth|token|secret|passw(or)?d|session|signature|credential/i

function isCredentialHeader(header: string): boolean {
  const name = /^\s*([^:\s]+)\s*:/.exec(header)?.[1]
  return name !== undefined && CREDENTIAL_HEADER_NAME.test(name)
}

/** `token` as one shell word: as-is when safe, else single-quoted. */
export function shellQuote(token: string): string {
  if (/^[A-Za-z0-9@%+=:,./_-]+$/.test(token)) {
    return token
  }
  return `'${token.replaceAll("'", String.raw`'\''`)}'`
}
