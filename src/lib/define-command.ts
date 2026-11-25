import type { CliContext } from './types'

export type HttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'

export type CommandClass = 'destructive' | 'read' | 'write'

export type ArgSpec = {
  readonly name: string
  readonly summary: string
  readonly isRequired: boolean
}

export type FlagSpec = {
  readonly flag: string
  readonly summary: string
  readonly defaultValue?: string | boolean
}

export type CommandInvocation = {
  readonly ctx: CliContext
  readonly args: Readonly<Record<string, string>>
  readonly flags: Readonly<Record<string, unknown>>
  readonly input?: Readonly<Record<string, unknown>>
}

export type CommandOutcome = {
  readonly data: unknown
  readonly human?: string | (() => string)
  readonly exitCode?: number
}

export type CommandSpec = {
  readonly path: readonly string[]
  readonly summary: string
  readonly sdkMethod: string | null
  readonly derivedFrom?: string | readonly string[]
  readonly route?: {
    readonly method: HttpMethod
    readonly path: string
  }
  readonly commandClass: CommandClass
  readonly isCredited?: boolean
  readonly defaultTimeoutMs?: number
  readonly isRawTransport?: boolean
  readonly inputKeys?: { readonly extra: readonly string[] } | 'unchecked'
  readonly args?: readonly ArgSpec[]
  readonly flags?: readonly FlagSpec[]
  readonly examples: readonly string[]
  readonly prepareInput?: (
    invocation: CommandInvocation
  ) => Promise<Readonly<Record<string, unknown>>>
  readonly confirmSummary?: (
    invocation: Omit<CommandInvocation, 'ctx'>
  ) => string | undefined
  readonly run: (
    invocation: CommandInvocation
  ) => Promise<CommandOutcome | undefined>
}

export function defineCommand(spec: CommandSpec): CommandSpec {
  return spec
}

export type CommandMetadata = Pick<
  CommandSpec,
  | 'path'
  | 'summary'
  | 'sdkMethod'
  | 'derivedFrom'
  | 'route'
  | 'commandClass'
  | 'isCredited'
  | 'isRawTransport'
  | 'args'
  | 'flags'
  | 'examples'
> & { readonly confirmation: boolean }

export function commandMetadata(spec: CommandSpec): CommandMetadata {
  return {
    path: spec.path,
    summary: spec.summary,
    sdkMethod: spec.sdkMethod,
    ...(spec.derivedFrom !== undefined
      ? { derivedFrom: spec.derivedFrom }
      : {}),
    ...(spec.route !== undefined ? { route: spec.route } : {}),
    commandClass: spec.commandClass,
    ...(spec.isCredited !== undefined ? { isCredited: spec.isCredited } : {}),
    ...(spec.isRawTransport !== undefined
      ? { isRawTransport: spec.isRawTransport }
      : {}),
    ...(spec.args !== undefined ? { args: spec.args } : {}),
    ...(spec.flags !== undefined ? { flags: spec.flags } : {}),
    examples: spec.examples,
    confirmation: spec.confirmSummary !== undefined,
  }
}

export const GLOBAL_FLAGS: readonly FlagSpec[] = [
  {
    flag: '--json',
    summary: 'JSON output (automatic when stdout is not a TTY)',
  },
  { flag: '--quiet', summary: 'Suppress progress messages on stderr' },
  {
    flag: '--yes',
    summary: 'Skip the confirmation gate on destructive commands',
  },
  {
    flag: '--api-key <key>',
    summary: 'Brew API key (else BREW_API_KEY, else stored login)',
  },
  {
    flag: '--brand <brandId>',
    summary: 'Brand id for organization-scoped keys (else BREW_BRAND_ID)',
  },
  {
    flag: '--api-url <url>',
    summary: 'API base URL (else BREW_API_URL, else https://brew.new/api)',
  },
  {
    flag: '--timeout <duration>',
    summary:
      'Give up after this long, retries and the response body included (90s, 1500ms, 5m)',
  },
  {
    flag: '--max-retries <n>',
    summary:
      'Retries after a transient failure, 0-10 (default 2; raw requests make one attempt)',
  },
]
